import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

export function dismissKeyboard() {
  if (Capacitor.isNativePlatform()) Keyboard.hide();
  else document.activeElement?.blur();
}

export function dismissKeyboardOnEnter(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    dismissKeyboard();
  }
}
