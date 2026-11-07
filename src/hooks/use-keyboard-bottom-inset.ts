import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/** Partie du clavier qui couvre encore la fenêtre (0 si Android a déjà rétréci l'écran). */
function coveredHeight(e: KeyboardEvent) {
  const windowHeight = Dimensions.get('window').height;
  const { screenY, height } = e.endCoordinates;
  if (screenY > 0 && windowHeight > 0) {
    return Math.min(height, Math.max(0, windowHeight - screenY));
  }
  return height;
}

/** Hauteur à réserver sous le contenu pour le garder au-dessus du clavier. */
export function useKeyboardBottomInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setInset(coveredHeight(e));
    const onHide = () => setInset(0);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return inset;
}
