import type { ImageSource } from 'expo-image';

/** Fond local utilisé uniquement quand CoreSimulator ne peut pas fournir de flux caméra. */
export const SIMULATED_CAMERA_IMAGE = require('../../assets/images/simulator-camera-paris.jpg') as ImageSource;
