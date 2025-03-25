import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';


const MentalPayAttentionScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.content}>
          {/* Image with overlay back button */}
          <View style={styles.imageContainer}>
            <Image
              source={require('../../../assets/payAttention.png')}
              style={styles.characterImage}
            />
            </View>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.overlayBackButton}
            >
              <Icon name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
        </View>
          
          {/* Main Card */}
          <View style={styles.mainCard}>
            <Text style={styles.greeting}>Hi, Alex, here's your daily score</Text>
            <Text style={styles.scoreText}>Pay Attention</Text>
            
            {/* Score Indicator */}
            <View style={styles.scoreIndicator}>
              <View style={[styles.indicatorDot, { backgroundColor: '#FF7B85' }]} />
              <View style={[styles.currentIndicatorDot, { backgroundColor: '#FEB27E' }]} />
              <View style={styles.sliderContainer}>
                <View style={styles.sliderDot} />
              </View>
              <View style={[styles.indicatorDot, { backgroundColor: '#819EF2' }]} />
              <View style={[styles.indicatorDot, { backgroundColor: '#7AD0A3' }]} />
            </View>
            
            {/* Metrics Section */}
            <View style={styles.metricsContainer}>
              {/* HRV Metric */}
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Avg.HRV Today</Text>
                <View style={styles.metricValueContainer}>
                  <Text style={styles.metricValue}>45</Text>
                  <Text style={styles.metricUnit}>ms</Text>
                </View>
                <Text style={styles.metricSubtext}>30d avg. 38ms</Text>
              </View>
              
              {/* RHR Metric */}
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>RHR</Text>
                <View style={styles.metricValueContainer}>
                  <Text style={styles.metricValue}>67</Text>
                  <Text style={styles.metricUnit}>bpm</Text>
                </View>
                <Text style={styles.metricSubtext}>Great</Text>
              </View>
            </View>
            
            {/* Analysis Text */}
            <View style={styles.analysisContainer}>
              <Text style={styles.analysisText}>
                Work and study should be balanced. Taking appropriate breaks is also good—there’s no need to push yourself too hard!
              </Text>
              <Text style={styles.analysisText}>
                Maintaining a rhythm of effort and relaxation is an effective way to cope with stress.
              </Text>
              
              <Text style={styles.analysisExplanationText}>
                Based on today's HRV (rMSSD) and resting heart rate data, your body is under noticeable stress. It's important to learn how to relax and adjust yourself to maintain both physical and mental balance. Check whether your recent sleep and exercise have been sufficient and whether you've consumed alcohol, caffeine, or medication, as these factors may increase stress levels.
              </Text>
              
              <TouchableOpacity>
                <Text style={styles.detailsButton}>More Details</Text>
              </TouchableOpacity>
            </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F9F8',
    },
    content: {
        paddingHorizontal: 20,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        marginBottom: 10,
    },
    characterImage: {
        width: 400,
        height: 330,
        resizeMode: 'contain',
        // borderRadius: 24,
        right: 20,
        top: -10,
    },
    overlayBackButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        backgroundColor: 'transparent',
        padding: 8,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.2)',
        zIndex: 10,
    },
    mainCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    greeting: {
        fontSize: 18,
        color: '#8A8D9F',
        marginBottom: 10,
        textAlign: 'center',
    },
    scoreText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 20,
    },
    scoreIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
      position: 'relative',
      width: '70%',
      justifyContent: 'space-between',
  },
  indicatorDot: {
      width: 30,
      height: 14,
      borderRadius: 7,
      zIndex: 1,
  },
  currentIndicatorDot: {
      width: 140,
      height: 14,
      borderRadius: 6,
      zIndex: 1,
      backgroundColor: '#7AD0A3',
  },
  sliderContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FEB27E',
    zIndex: 10,
    position: 'absolute',
    right: 160,
  },
  sliderDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FEB27E',
  },
    metricsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    metricBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        width: '48%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F0F0F0',
    },
    metricLabel: {
        fontSize: 14,
        color: '#8A8D9F',
        marginBottom: 8,
    },
    metricValueContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    metricValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#000',
    },
    metricUnit: {
        fontSize: 16,
        color: '#8A8D9F',
        marginBottom: 6,
        marginLeft: 2,
    },
    metricSubtext: {
        fontSize: 14,
        color: '#8A8D9F',
        marginTop: 4,
    },
    analysisContainer: {
        width: '100%',
        paddingTop: 20,
    },
    analysisText: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    analysisExplanationText: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
        marginBottom: 16,
    },
    detailsButton: {
        fontSize: 18,
        color: '#FEB27E',
        textAlign: 'center',
        marginTop: 10,
        fontWeight: 'semi-bold'
    },
})

export default MentalPayAttentionScreen;