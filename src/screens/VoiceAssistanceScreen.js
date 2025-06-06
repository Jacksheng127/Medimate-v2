import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useCallback
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Alert,
  ActivityIndicator, // Added for processing indicator
  PermissionsAndroid, // Added for Android permissions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system'; // Keep for directory management if needed
import { API_URL } from '../config/env'; // Import API_URL
import {
  transcribeAudio,
  processTranscriptionData,
} from '../services/TranscriptionService'; // Import transcription functions
import DisclaimerModal from '../components/DisclaimerModal';

// Helper function for time formatting
const calculateDuration = (milliseconds) => {
  if (!milliseconds) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const VoiceAssistanceScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false); // Controls overall listening state / mic active look
  const [isProcessing, setIsProcessing] = useState(false); // For transcription/AI call
  const [recording, setRecording] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('stopped'); // 'recording', 'stopped'
  const [audioPermission, setAudioPermission] = useState(false);
  const [sound, setSound] = useState(null); // For playback (optional, keep if needed)
  const [isPlaying, setIsPlaying] = useState(false); // For playback (optional)
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null); // For playback (optional)
  const [currentDuration, setCurrentDuration] = useState('0:00');
  const [isStoppingRecording, setIsStoppingRecording] = useState(false); // Prevent double stops

  const scrollViewRef = useRef(null);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  
  // Show disclaimer popup after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowDisclaimer(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // --- Request Audio Permissions (Adapted from TranscribeAIScreen) ---
  useEffect(() => {
    const requestPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Audio Recording Permission',
              message: 'MediMate needs access to your microphone to record audio.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          setAudioPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
             Alert.alert("Permission Required", "Microphone access is needed for voice input.");
             return;
          }
        } else {
           const { status } = await Audio.requestPermissionsAsync();
           setAudioPermission(status === 'granted');
           if (status !== 'granted') {
             Alert.alert("Permission Required", "Microphone access is needed for voice input.");
             return;
           }
        }

        // Configure audio mode once permission is granted
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          // Use numeric values for interruption modes if constants cause issues
          interruptionModeIOS: 1, // INTERRUPTION_MODE_IOS_DO_NOT_MIX
          interruptionModeAndroid: 1, // INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
        });

      } catch (error) {
        console.error("Error requesting/setting audio permissions:", error);
        Alert.alert("Error", "Could not configure audio recording.");
      }
    };

    requestPermission();

    // Cleanup audio mode on unmount
    return () => {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        // Reset other properties if needed
      }).catch(err => console.log("Error resetting audio mode:", err));
    };
  }, []);
  // -----------------------------------------------------------------

  // Start pulsing animation when listening/recording
  useEffect(() => {
    let pulseAnimation;
    let wave1Animation, wave2Animation, wave3Animation;

    if (recordingStatus === 'recording') {
      // Pulse animation
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulseAnimation.start();

      // Wave animations
      wave1Animation = Animated.loop(Animated.sequence([ Animated.timing(waveAnim1, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(waveAnim1, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }) ])); wave1Animation.start();
      wave2Animation = Animated.loop(Animated.sequence([ Animated.timing(waveAnim2, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(waveAnim2, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }) ])); wave2Animation.start();
      wave3Animation = Animated.loop(Animated.sequence([ Animated.timing(waveAnim3, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(waveAnim3, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }) ])); wave3Animation.start();

    } else {
      // Reset animations
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
      // Stop any running animations
      pulseAnimation?.stop();
      wave1Animation?.stop();
      wave2Animation?.stop();
      wave3Animation?.stop();
    }

    return () => {
      // Cleanup animations on state change or unmount
      pulseAnimation?.stop();
      wave1Animation?.stop();
      wave2Animation?.stop();
      wave3Animation?.stop();
    };
  }, [recordingStatus]); // Rerun effect when recordingStatus changes

  // Switch to chat mode
  const switchToChatMode = () => {
    navigation.replace('WellnessAIChatbot'); // Use replace if it's a direct switch
  };

  // Handle new message (add to state and scroll)
  const handleNewMessage = useCallback((message) => {
    const messageWithDefaults = {
      ...message,
      type: message.type || 'text', // Default to text if type not specified
      id: message.id || Date.now().toString(), // Ensure unique ID
      timestamp: message.timestamp || new Date(), // Add timestamp
    };
    setMessages(prevMessages => [...prevMessages, messageWithDefaults]);
  }, []); // useCallback to memoize the function

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100); // Delay slightly
    }
  }, [messages]);

  // --- Playback Functions (Keep if needed, otherwise remove) ---
  const playVoiceMessage = async (uri, messageId) => { /* ... keep existing logic ... */ };
  const stopPlayback = async () => { /* ... keep existing logic ... */ };
  const onPlaybackStatusUpdate = (status) => { /* ... keep existing logic ... */ };
  // -----------------------------------------------------------

  // --- NEW: Callback for Recording Status Updates ---
  const onRecordingStatusUpdate = (status) => {
    if (!status.isRecording) {
      // Recording stopped unexpectedly or finished
      // You might want to handle this case, e.g., reset duration display
      // setCurrentDuration('0:00'); // Optional: Reset if needed
      return;
    }
    // Update duration display when recording status updates
    if (status.durationMillis) {
      setCurrentDuration(calculateDuration(status.durationMillis));
    }
  };
  // ---------------------------------------------

  // --- Start Recording (Adapted from TranscribeAIScreen) ---
  const startRecording = async () => {
    if (!audioPermission) {
      Alert.alert('Permission Required', 'Microphone permission is required.');
      return;
    }
    if (recordingStatus === 'recording') return; // Already recording

    try {
      console.log('Starting recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
         Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // --- SET STATUS UPDATE CALLBACK ---
      newRecording.setOnRecordingStatusUpdate(onRecordingStatusUpdate);
      // --------------------------------

      setRecording(newRecording);
      setRecordingStatus('recording');
      setIsListening(true); // Indicate mic is active
      setIsStoppingRecording(false);
      setCurrentDuration('0:00');

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Could not start recording.');
      setRecordingStatus('stopped');
      setIsListening(false);
    }
  };

  // --- Stop Recording, Transcribe, and Send to Chat (Adapted) ---
  const stopRecording = async () => {
    // Prevent multiple calls or stopping when not recording
    if (isStoppingRecording || !recording) {
       console.log("Stop recording called but conditions not met:", {isStoppingRecording, recordingExists: !!recording});
       return;
    }

    console.log('Attempting to stop recording...');
    setIsStoppingRecording(true); // Set flag immediately
    setIsListening(false); // Mic is no longer actively listening

    try {
      // --- CLEAR STATUS UPDATE CALLBACK ---
      // Important to prevent updates after unload
      if (recording) {
        recording.setOnRecordingStatusUpdate(null);
      }
      // ----------------------------------

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);
      setRecording(null); // Clear recording instance *after* getting URI
      setRecordingStatus('stopped');
      setIsStoppingRecording(false); // <<< RESET isStoppingRecording HERE

      // Reset duration display after stopping
      setCurrentDuration('0:00');

      if (uri) {
        // --- Transcribe Audio ---
        setIsProcessing(true); // Show processing indicator
        try {
          console.log('Transcribing audio from URI:', uri);
          const transcriptionResult = await transcribeAudio(uri); // Use the service
          console.log('Raw transcription result:', transcriptionResult);

          const processedData = processTranscriptionData(transcriptionResult);
          const transcribedText = processedData.text;
          console.log('Processed transcription text:', transcribedText);

          if (transcribedText && transcribedText.trim() !== '') {
             // Display user's transcribed message immediately
             handleNewMessage({
               source: 'user',
               type: 'text', // Display as text
               message: transcribedText,
             });

             // Send transcribed text to the backend chat endpoint
             // NOTE: sendInputToChatbot will handle setting isProcessing to false in its finally block
             await sendInputToChatbot(transcribedText);
          } else {
             console.log('Transcription result was empty or only whitespace.');
             Alert.alert("Transcription", "Could not understand audio or no speech detected.");
             setIsProcessing(false); // Hide indicator if transcription is empty
          }
        } catch (transcriptionError) {
          console.error('Transcription or processing failed:', transcriptionError);
          Alert.alert('Transcription Error', 'Sorry, I could not process the audio. Please try again.');
          setIsProcessing(false); // Hide indicator on transcription error
        }
        // -------------------------------
      } else {
        console.warn('Recording URI is null after stopping.');
        Alert.alert("Recording Error", "Could not retrieve the recorded audio file.");
        setIsProcessing(false); // Hide indicator if URI is missing
        // No need to set isStoppingRecording here, already done above
      }
    } catch (err) {
      console.error('Failed to stop/unload recording', err);
      Alert.alert('Recording Error', 'Could not properly stop the recording.');
      // Reset states carefully on error
      setRecordingStatus('stopped');
      setRecording(null);
      setIsStoppingRecording(false); // Ensure reset in catch block too
      setIsProcessing(false); // Ensure indicator is hidden on stop/unload error
      setCurrentDuration('0:00'); // Reset duration on error too
    }
    // Note: isProcessing is handled within the transcription try/catch and sendInputToChatbot's finally block
  };
  // ----------------------------------------------------------

  // --- Function to send input to Chatbot Backend ---
  const sendInputToChatbot = async (messageText) => {
     if (!messageText || messageText.trim() === '') {
       // Don't proceed if message is empty, ensure processing is false
       setIsProcessing(false);
       return;
     }

     // Ensure processing indicator is on
     if (!isProcessing) setIsProcessing(true);

     // Add placeholder for AI response (optional, could just wait)
     const aiThinkingMessageId = `ai-thinking-${Date.now()}`;
     handleNewMessage({
       source: 'ai',
       type: 'text',
       message: '...', // Indicate thinking
       id: aiThinkingMessageId,
     });

     try {
       console.log(`Sending to ${API_URL}/chat:`, messageText);
       const response = await fetch(`${API_URL}/chat`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
         body: JSON.stringify({ message: messageText }),
       });

       if (!response.ok) {
         const errorBody = await response.text();
         console.error('Chatbot API error:', response.status, errorBody);
         throw new Error(`Chatbot request failed: ${response.status}. ${errorBody}`);
       }

       // --- Handle Streaming Response (Using response.text() - Needs Improvement) ---
       // WARNING: This waits for the full response.
       // TODO: Refactor to use response.body.getReader() for true streaming.
       const responseText = await response.text();
       console.log('Raw response text from /chat:', responseText); // Keep for debugging if needed

       let aiResponseText = '';
       let parseErrorOccurred = false;
       try {
         // Attempt to parse assuming newline-separated JSON chunks
         const lines = responseText.split('\n').filter(line => line.trim());
         if (lines.length > 0) {
           for (const line of lines) {
             try {
               const data = JSON.parse(line);
               if (data.text) {
                 aiResponseText += data.text; // Accumulate only the 'text' part
               } else if (data.error) {
                 // Handle potential error messages within the stream
                 console.error("Error chunk received from backend:", data.error);
                 aiResponseText = `Error: ${data.error}`; // Display backend error
                 parseErrorOccurred = true; // Treat as error
                 break; // Stop processing further chunks on error
               }
             } catch (jsonParseError) {
               // If a line isn't valid JSON, it might be the whole response or an error string
               console.warn("Line is not JSON, treating as plain text:", line, jsonParseError);
               if (!parseErrorOccurred && lines.length === 1) {
                 // If it's the only line and not JSON, use it directly
                 aiResponseText = line;
               } else if (!parseErrorOccurred) {
                 // Append non-JSON line if it's the first unexpected format
                 aiResponseText += line + '\n';
               }
               parseErrorOccurred = true; // Mark that unexpected format was encountered
             }
           }
         } else {
           // Handle empty response body
           console.warn("Received empty response body from /chat");
           aiResponseText = "Received an empty response.";
           parseErrorOccurred = true;
         }

       } catch (e) {
         // Catch errors during splitting or general processing
         console.error("Error processing response text:", e);
         aiResponseText = "Error processing response."; // Fallback error message
         parseErrorOccurred = true;
       }

       // Update the thinking message with the final AI response, or replace if needed
       setMessages(prevMessages =>
         prevMessages.map(msg =>
           msg.id === aiThinkingMessageId
             ? { ...msg, message: aiResponseText.trim() } // Update the thinking bubble
             : msg
         )
       );
       // ---------------------------------------------------------------------------------

     } catch (error) {
       console.error('Error sending/receiving message to/from chatbot:', error);
       // Update the thinking message with an error
       setMessages(prevMessages =>
         prevMessages.map(msg =>
           msg.id === aiThinkingMessageId
             ? { ...msg, message: `Sorry, an error occurred: ${error.message || 'Please try again.'}` }
             : msg
         )
       );
     } finally {
       // IMPORTANT: Ensure processing state is reset and button is re-enabled
       setIsProcessing(false);
       console.log("Processing finished, button should be enabled.");
       // Optional: Re-enable listening automatically if desired
       // setIsListening(true);
     }
  };
  // ----------------------------------------------------------

  // Handle recording button press (simplified)
  const handleRecordingButtonPress = () => {
    if (recordingStatus === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle suggestion chip press
  const handleSuggestionPress = async (question) => {
    // Stop recording if active
    if (recordingStatus === 'recording') {
      await stopRecording(); // Wait for stop to complete if needed
    }

    // Add user message
    handleNewMessage({
      source: 'user',
      message: question
    });

    // Send to chatbot
    await sendInputToChatbot(question);
  };

  // Cleanup on unmount
  useEffect(() => {
    // This function now ONLY runs when the component unmounts
    return () => {
      console.log("Running cleanup on unmount..."); // Add log for verification
      // Check if recording instance exists *at the time of unmount*
      // Use a ref to hold the recording instance if needed for more complex scenarios,
      // but checking the state variable directly in the unmount cleanup is often sufficient.
      if (recording) {
        console.log("Attempting to unload recording on unmount...");
        // Clear callback before unloading during cleanup as well
        recording.setOnRecordingStatusUpdate(null);
        recording.stopAndUnloadAsync()
          .then(() => console.log("Successfully unloaded recording on unmount."))
          .catch(err => {
            // Check if the error is the specific "already unloaded" error and ignore it if so
            if (err.message.includes("Cannot unload a recording that has already been unloaded")) {
              console.log("Recording was already unloaded before unmount cleanup.");
            } else {
              console.error("Error unloading recording on unmount:", err);
            }
          });
      }
      if (sound) {
        console.log("Attempting to unload sound on unmount...");
        sound.unloadAsync()
         .then(() => console.log("Successfully unloaded sound on unmount."))
         .catch(err => console.error("Error unloading sound on unmount:", err));
      }
    };
  }, []); // <-- Correct: Empty dependency array ensures this runs only on unmount

  // --- Render Message Function (Example - Adapt as needed) ---
  const renderMessage = ({ item }) => {
    const isUser = item.source === 'user';
    const isVoice = item.type === 'voice'; // Check if it's a voice message

    return (
      <View
        key={item.id} // Use item.id for key
        style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.aiMessage
        ]}
      >
        {/* AI Avatar */}
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Icon name="smart-toy" size={20} color="#FFFFFF" />
          </View>
        )}

        {/* Message Content */}
        <View
          style={[
            styles.messageContent,
            isUser ? styles.userMessageContent : styles.aiMessageContent,
            isVoice && styles.voiceMessageContent // Specific style for voice bubbles
          ]}
        >
          {isVoice ? (
            // --- Voice Message UI (Keep if playback is desired) ---
            <TouchableOpacity
              style={styles.voiceMessageContainer}
              onPress={() => playVoiceMessage(item.uri, item.id)}
            >
              <View style={styles.voicePlayButton}>
                <Icon
                  name={isPlaying && currentlyPlayingId === item.id ? "pause" : "play-arrow"}
                  size={20}
                  color={isUser ? "#FFFFFF" : "#1167FE"}
                />
              </View>
              <View style={styles.voiceWaveform}>
                {/* Simplified waveform */}
                <View style={styles.voiceWaveformBars}>
                  {[...Array(8)].map((_, i) => (
                    <View key={i} style={[ styles.voiceWaveformBar, { height: 5 + Math.random() * 15 }, isUser ? styles.userVoiceWaveformBar : styles.aiVoiceWaveformBar ]} />
                  ))}
                </View>
              </View>
              <Text style={[ styles.voiceDuration, isUser ? styles.userMessageText : styles.aiMessageText ]}>
                {item.duration || '0:00'}
              </Text>
            </TouchableOpacity>
            // ----------------------------------------------------
          ) : (
            // --- Text Message UI ---
            <Text style={[ styles.messageText, isUser ? styles.userMessageText : styles.aiMessageText ]}>
              {item.message}
            </Text>
            // -----------------------
          )}
        </View>
      </View>
    );
  };
  // ---------------------------------------------------------

  // Determine mic button instructions
  const getMicInstructions = () => {
    if (recordingStatus === 'recording') return `Recording... ${currentDuration}`;
    if (isProcessing) return "Processing...";
    // if (isListening) return "Listening..."; // Optional state if needed
    return "Tap microphone to talk";
  };

  console.log('Render check - Button Disabled State:', {
    audioPermission,
    isProcessing,
    isStoppingRecording,
    isDisabled: !audioPermission || isProcessing || isStoppingRecording // Calculate the disabled state here
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      {/* --- Header --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <TouchableOpacity onPress={switchToChatMode}>
           <Icon name="chat" size={24} color="#1167FE" />
        </TouchableOpacity>
      </View>
      {/* ------------ */}

      {/* Remove Mode Toggle Button if header icon is used */}
      {/* <View style={styles.modeToggleContainer}> ... </View> */}

      <View style={styles.voiceContainer}>
        {/* --- Conversation Area --- */}
        <ScrollView
          style={styles.conversationContainer}
          ref={scrollViewRef}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 10 }} // Added paddingBottom
        >
          {messages.length === 0 && !isProcessing && (
             <Text style={styles.emptyChatText}>Tap the mic or a suggestion to start.</Text>
          )}
          {messages.map((msg) => renderMessage({ item: msg }))}
          {/* Optional: Add a specific indicator while AI is fetching response */}
          {isProcessing && messages.length > 0 && (
             <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color="#1167FE" />
             </View>
          )}
        </ScrollView>
        {/* ----------------------- */}

        {/* --- Mic Button Area --- */}
        <View style={styles.micButtonContainer}>
          <View style={styles.micButtonWrapper}>
            {/* Wave Animations */}
            {recordingStatus === 'recording' && (
              <View style={styles.wavesContainer}>
                <Animated.View style={[styles.wave, { opacity: waveAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }), transform: [{ scale: 1.8 }] }]} />
                <Animated.View style={[styles.wave, { opacity: waveAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }), transform: [{ scale: 2.4 }] }]} />
                <Animated.View style={[styles.wave, { opacity: waveAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }), transform: [{ scale: 3.0 }] }]} />
              </View>
            )}
            {/* Mic Button */}
            <TouchableOpacity
              style={[
                styles.micButton,
                // isListening && !isProcessing && styles.micButtonActive, // Style for listening state if needed
                recordingStatus === 'recording' && styles.micButtonRecording,
              ]}
              onPress={handleRecordingButtonPress}
              disabled={!audioPermission || isProcessing || isStoppingRecording} // Disable while processing or stopping
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.buttonInner,
                  // isListening && !isProcessing && styles.buttonInnerActive, // Style for listening state
                  isProcessing && styles.buttonInnerProcessing, // Style for processing
                  { transform: [{ scale: pulseAnim }] } // Pulse animation only when recording
                ]}
              >
                {/* Icon changes based on state */}
                <Icon
                  name={isProcessing ? "autorenew" : "mic"} // Show loading icon when processing
                  size={32}
                  color="#FFFFFF"
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
          {/* Mic Instructions Text */}
          <Text style={styles.micInstructions}>
            {getMicInstructions()}
          </Text>
        </View>
        {/* --------------------- */}

        {/* --- Suggestion Chips --- */}
        {!isProcessing && !isStoppingRecording && recordingStatus !== 'recording' && ( // Hide suggestions during processing/recording
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Try asking</Text>
            <View style={styles.suggestionChips}>
              {/* Keep existing suggestion chips */}
              <TouchableOpacity style={styles.suggestionChip} onPress={() => handleSuggestionPress("What's my blood pressure?")}><Text style={styles.suggestionChipText}>Blood pressure?</Text></TouchableOpacity>
              <TouchableOpacity style={styles.suggestionChip} onPress={() => handleSuggestionPress("How can I lower my glucose levels?")}><Text style={styles.suggestionChipText}>Lower glucose?</Text></TouchableOpacity>
              <TouchableOpacity style={styles.suggestionChip} onPress={() => handleSuggestionPress("What's my medication schedule?")}><Text style={styles.suggestionChipText}>Med schedule?</Text></TouchableOpacity>
              <TouchableOpacity style={styles.suggestionChip} onPress={() => handleSuggestionPress("Tips to quit smoking?")}><Text style={styles.suggestionChipText}>Quit smoking tips?</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {/* ---------------------- */}
      </View>
      <DisclaimerModal 
        visible={showDisclaimer} 
        onClose={() => setShowDisclaimer(false)}
      />
    </SafeAreaView>
  );
};

// --- Styles (Combine and adapt) ---
const styles = StyleSheet.create({
  // ... (Keep most existing styles from VoiceAssistanceScreen.js) ...

  // Add/Update styles as needed
  container: { flex: 1, backgroundColor: '#F8F9FA' }, // Lighter background
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  voiceContainer: { flex: 1, justifyContent: 'space-between', paddingBottom: 10 }, // Reduced bottom padding
  conversationContainer: { flex: 1, paddingHorizontal: 16 }, // Added horizontal padding
  messageBubble: { flexDirection: 'row', marginBottom: 16, maxWidth: '85%' }, // Slightly increased max width
  aiMessage: { alignSelf: 'flex-start' },
  userMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1167FE', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  messageContent: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, maxWidth: '100%' }, // Adjusted padding
  aiMessageContent: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEE' },
  userMessageContent: { backgroundColor: '#1167FE' },
  messageText: { fontSize: 15, lineHeight: 21 }, // Adjusted line height
  aiMessageText: { color: '#333' },
  userMessageText: { color: '#FFFFFF' },
  micButtonContainer: { alignItems: 'center', marginVertical: 10 }, // Reduced vertical margin
  micButtonWrapper: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }, // Reduced bottom margin
  wavesContainer: { position: "absolute", alignItems: "center", justifyContent: "center" },
  wave: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "#1167FE" },
  micButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(17, 103, 254, 0.1)", alignItems: "center", justifyContent: "center" },
  // micButtonActive: { backgroundColor: "rgba(17, 103, 254, 0.2)" }, // Style for general listening state (optional)
  micButtonRecording: { backgroundColor: "rgba(255, 0, 0, 0.3)" }, // Red tint when recording
  buttonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#1167FE", alignItems: "center", justifyContent: "center", shadowColor: "#1167FE", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }, // Reduced shadow radius
  // buttonInnerActive: { backgroundColor: "#1167FE" }, // Style for general listening state (optional)
  buttonInnerProcessing: { backgroundColor: "#FFC107", shadowColor: "#FFC107" }, // Yellow/Orange for processing
  micInstructions: { fontSize: 14, color: '#666666', textAlign: 'center', height: 20 }, // Fixed height to prevent layout shifts
  suggestionsContainer: { paddingHorizontal: 16, marginBottom: 10 }, // Added horizontal padding
  suggestionsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#555' }, // Adjusted style
  suggestionChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }, // Center chips
  suggestionChip: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, margin: 4, borderWidth: 1, borderColor: '#E0E0E0' },
  suggestionChipText: { fontSize: 13, color: '#1167FE' }, // Slightly smaller text
  emptyChatText: { textAlign: 'center', marginTop: 50, color: '#AAAAAA', fontSize: 16 },
  typingIndicator: { alignSelf: 'flex-start', marginLeft: 50, marginBottom: 10 }, // Position near AI messages

  // --- Voice Message Specific Styles (Keep if using playback) ---
  voiceMessageContent: { minWidth: 150, maxWidth: 250 },
  voiceMessageContainer: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  voicePlayButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 0, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  voiceWaveform: { flex: 1, height: 40, justifyContent: 'center' },
  voiceWaveformBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 25 }, // Adjusted height
  voiceWaveformBar: { width: 3, borderRadius: 3, marginHorizontal: 1.5 }, // Adjusted margin
  aiVoiceWaveformBar: { backgroundColor: '#1167FE' },
  userVoiceWaveformBar: { backgroundColor: 'rgba(255, 255, 255, 0.7)' }, // Slightly transparent white
  voiceDuration: { fontSize: 12, marginLeft: 8, minWidth: 35, textAlign: 'right' }, // Ensure space for duration
  // -----------------------------------------------------------
});

export default VoiceAssistanceScreen;