import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

// Formule mathématique de Haversine pour calculer la distance (en mètres) entre deux points GPS
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3; // Rayon de la terre en mètres
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Retourne la distance arrondie en mètres
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function usePunchLocation(targetLatitude, targetLongitude) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loadingLocalisation, setLoadingLocalisation] = useState(true);

  // Le géocadre stricte de 500 mètres
  const RANGE_LIMIT_METERS = 500;

  useEffect(() => {
    let subscriber = null;

    const startLocationTracking = async () => {
      try {
        setLoadingLocalisation(true);
        setErrorMsg(null);
        
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg("Permission GPS refusée. Veuillez activer la localisation dans les réglages de votre appareil.");
          setLoadingLocalisation(false);
          return;
        }

        // Configuration du GPS (Précision élevée, mise à jour toutes les 5 secondes ou 5 mètres)
        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (location) => {
            setCurrentLocation(location.coords);
            if (targetLatitude && targetLongitude) {
              const distance = getDistanceFromLatLonInM(
                location.coords.latitude,
                location.coords.longitude,
                targetLatitude,
                targetLongitude
              );
              setDistanceMeters(distance);
              setIsWithinRange(distance !== null && distance <= RANGE_LIMIT_METERS);
            } else {
               // Si le projet n'a pas de coordonnée
               setDistanceMeters(null);
               setIsWithinRange(false);
            }
            setLoadingLocalisation(false);
          }
        );
      } catch (error) {
        console.error("GPS Error:", error);
        setErrorMsg("Impossible de démarrer le service de localisation GPS. Assurez-vous qu'il soit activé.");
        setLoadingLocalisation(false);
      }
    };

    startLocationTracking();

    return () => {
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, [targetLatitude, targetLongitude]);

  return {
    currentLocation,
    distanceMeters,
    isWithinRange,
    errorMsg,
    loadingLocalisation,
    RANGE_LIMIT_METERS
  };
}
