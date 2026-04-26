import React from 'react';
import { TouchableOpacity, Alert, Text, StyleSheet } from 'react-native';

export default function TooltipIcon({ title, text }) {
    return (
        <TouchableOpacity 
            style={styles.iconContainer}
            onPress={() => Alert.alert(title, text)}
            accessibilityLabel={`Info pour ${title}`}
            accessibilityRole="button"
        >
            <Text style={styles.iconText}>?</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#999'
    },
    iconText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333'
    }
});
