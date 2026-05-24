import { addDoc, setDoc, query, where, collection } from 'firebase/firestore';
import { db } from '../config/firebase';

// Variable locale pour garder en mémoire le companyId de l'utilisateur actif
let activeCompanyId = null;

/**
 * Initialise le tenant actif. À appeler lors du login dans App.js.
 * @param {string} companyId - Le companyId de l'utilisateur connecté
 */
export const setTenant = (companyId) => {
  activeCompanyId = companyId;
};

/**
 * Récupère le companyId actuel ou lève une erreur s'il est manquant.
 */
export const requireTenant = () => {
  if (!activeCompanyId) {
    throw new Error('Opération bloquée: Aucun companyId actif. L\'utilisateur doit être connecté.');
  }
  return activeCompanyId;
};

/**
 * Wrapper sécurisé pour `addDoc`. Injecte automatiquement le `companyId`.
 */
export const addTenantDoc = async (collectionRef, data) => {
  const companyId = requireTenant();
  return await addDoc(collectionRef, {
    ...data,
    companyId,
    createdAt: data.createdAt || new Date()
  });
};

/**
 * Wrapper sécurisé pour `setDoc`. Injecte automatiquement le `companyId`.
 */
export const setTenantDoc = async (docRef, data, options = {}) => {
  const companyId = requireTenant();
  // Attention: si merge est true, on s'assure d'écraser le companyId quand même
  return await setDoc(docRef, { ...data, companyId }, options);
};

/**
 * Utilitaire pour créer facilement une requête filtrée par le companyId.
 * Exemple: const q = getTenantQuery('projects', where('status', '==', 'active'));
 */
export const getTenantQuery = (collectionName, ...additionalWheres) => {
  const companyId = requireTenant();
  return query(
    collection(db, collectionName),
    where('companyId', '==', companyId),
    ...additionalWheres
  );
};
