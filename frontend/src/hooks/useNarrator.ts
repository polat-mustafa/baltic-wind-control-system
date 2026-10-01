/**
 * Voice narration with the browser's Web Speech API (no server, no cost).
 *
 * Picks a voice for the requested language (English or Turkish), exposes
 * whether it is speaking, and stops on unmount so a lesson never keeps
 * talking after the user has left the page. Silent where speechSynthesis is
 * unavailable (tests, some browsers).
 */

import { useCallback, useEffect, useState } from "react";

export type NarrationLang = "en" | "tr";

const BCP47: Record<NarrationLang, string> = { en: "en-GB", tr: "tr-TR" };

function pickVoice(lang: NarrationLang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === BCP47[lang]) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ??
    undefined
  );
}

export function useNarrator() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, lang: NarrationLang = "en") => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[lang];
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      u.rate = 1.0;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [supported],
  );

  useEffect(() => stop, [stop]);

  return { supported, speaking, speak, stop };
}
