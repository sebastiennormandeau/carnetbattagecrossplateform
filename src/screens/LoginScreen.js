import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { theme } from '../theme/Theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const getFrenchErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-email': return "L'adresse e-mail n'est pas valide.";
      case 'auth/user-not-found': return "Aucun utilisateur trouvé avec cette adresse e-mail.";
      case 'auth/wrong-password': return "Mot de passe incorrect.";
      case 'auth/invalid-credential': return "Identifiants invalides. Veuillez vérifier votre courriel et mot de passe.";
      case 'auth/too-many-requests': return "Trop de tentatives échouées. Veuillez réessayer plus tard.";
      case 'auth/user-disabled': return "Ce compte a été désactivé par un administrateur.";
      case 'auth/network-request-failed': return "Erreur réseau. Veuillez vérifier votre connexion internet.";
      default: return "Une erreur est survenue lors de la connexion.";
    }
  };

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      
      // Mirroring et vérification de bannissement
      const userRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().banned === true) {
         await signOut(auth);
         setErrorMsg('Votre compte a été banni par un administrateur.');
         return;
      }
      
      await setDoc(userRef, {
         email: cred.user.email,
         uid: cred.user.uid,
         lastLogin: Date.now()
      }, { merge: true });

    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg(getFrenchErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg('');
    if (!email) {
      setErrorMsg('Veuillez entrer votre adresse e-mail pour réinitialiser votre mot de passe.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Succès', 'Un e-mail de réinitialisation de mot de passe a été envoyé à ' + email);
    } catch (error) {
      console.error("Password reset error:", error);
      setErrorMsg(getFrenchErrorMessage(error.code));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Carnet Battage</Text>
      
      {errorMsg ? (
        <Text style={styles.errorText}>{errorMsg}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Adresse e-mail"
        placeholderTextColor={theme.colors.textMuted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={theme.colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.forgotPasswordButton} 
        onPress={handleForgotPassword}
      >
        <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 40,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger || 'red',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  button: {
    backgroundColor: theme.colors.primaryDark,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
