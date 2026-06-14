import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/Theme';

export default function DepthMapScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface }}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.btnText}>Retour</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <View style={styles.content}>
                <Text style={styles.messageTitle}>Carte non disponible</Text>
                <Text style={styles.messageDesc}>
                    La carte interactive (Google Maps) n'est pas optimisée pour la version Web. Veuillez utiliser l'application mobile pour accéder à cette fonctionnalité.
                </Text>
                
                <TouchableOpacity 
                  style={styles.btnPrimary} 
                  onPress={() => navigation.goBack()}
                >
                    <Text style={{ color: '#121212', fontWeight: 'bold' }}>Retourner à l'accueil</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#000' 
    },
    topBar: { 
        flexDirection: 'row', 
        padding: 15, 
        backgroundColor: theme.colors.surface 
    },
    btnText: { 
        color: 'white', 
        fontWeight: '500' 
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    messageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.primary,
        marginBottom: 15,
        textAlign: 'center'
    },
    messageDesc: {
        fontSize: 16,
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24
    },
    btnPrimary: { 
        backgroundColor: theme.colors.primary, 
        padding: 15, 
        borderRadius: 8, 
        alignItems: 'center',
        minWidth: 200
    }
});
