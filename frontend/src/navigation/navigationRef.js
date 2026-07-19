import { createNavigationContainerRef } from '@react-navigation/native';

// Notifications are allowed to open only an aggregate dashboard destination. The ref
// avoids putting route-selection logic into the push payload or exposing record detail
// through notification text.
export const navigationRef = createNavigationContainerRef();
