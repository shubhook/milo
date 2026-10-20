import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ConfigPlugin = string | [string, Record<string, unknown>];

type MobileAppConfig = {
  expo: {
    plugins: ConfigPlugin[];
  };
};

function readMobileAppConfig(): MobileAppConfig {
  const path = resolve(import.meta.dirname, "..", "app.json");
  return JSON.parse(readFileSync(path, "utf8")) as MobileAppConfig;
}

describe("Android permission config", () => {
  it("does not declare voice-only microphone or speech recognition permissions", () => {
    const plugins = readMobileAppConfig().expo.plugins;
    const imagePicker = plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === "expo-image-picker",
    );
    const audio = plugins.find(
      (plugin) => plugin === "expo-audio" || (Array.isArray(plugin) && plugin[0] === "expo-audio"),
    );
    const speechRecognition = plugins.find(
      (plugin) =>
        plugin === "expo-speech-recognition" ||
        (Array.isArray(plugin) && plugin[0] === "expo-speech-recognition"),
    );

    expect(imagePicker).toBeDefined();
    expect(imagePicker?.[1].microphonePermission).toBeUndefined();
    expect(audio).toBeUndefined();
    expect(speechRecognition).toBeUndefined();
  });
});
