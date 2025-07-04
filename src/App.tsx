import React, { useState, useEffect, useRef } from "react";

const stopwords = new Set(["in", "the", "a", "an", "and", "of", "on", "for", "to", "is"]);

function extractKeywords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word && !stopwords.has(word));
}

export default function StoryWithImages() {
  const [prompt, setPrompt] = useState("");
  const [story, setStory] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [language, setLanguage] = useState("en"); // 'en', 'hi', 'te'
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [inputsDisabled, setInputsDisabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStoryGenerated, setIsStoryGenerated] = useState(false);

  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY!;
  const unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY!;
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const getLangCode = (lang: string) => {
    return lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : "en-US";
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getLangCode(language);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
  }, [language]);

  async function generateStoryAndImages() {
    if (!prompt.trim()) return;

    setInputsDisabled(true);
    setLoading(true);
    setStory("");
    setImages([]);
    setIsStoryGenerated(false);
    stopSpeech();

    try {
      const langLabel = language === "hi" ? "Hindi" : language === "te" ? "Telugu (native script)" : "English";
      const storyPrompt = `
You are a creative children's storyteller. Write a fun and imaginative story for a 6-year-old in ${langLabel}.
Topic: ${prompt}

Make the story at least 6 paragraphs long. 
Use simple, playful language and break it into small, easy-to-read paragraphs.
Add engaging moments and emotional depth (like surprise, fun, friendship, curiosity).
`;


      const storyRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3-0324",
          messages: [{ role: "user", content: storyPrompt }],
        }),
      });

      const storyData = await storyRes.json();
      if (!storyRes.ok) throw new Error(storyData?.error?.message || "Story generation failed.");

      const storyText = storyData.choices[0].message.content;
      setStory(storyText);
      setIsStoryGenerated(true);

      const keywords = extractKeywords(prompt).slice(0, 5);
      const fetchedImages: string[] = [];

      for (const word of keywords) {
        try {
          const res = await fetch(
            `https://api.unsplash.com/photos/random?query=${word}&client_id=${unsplashAccessKey}`
          );
          const data = await res.json();
          fetchedImages.push(data?.urls?.small || "https://placekitten.com/256/256");
        } catch {
          fetchedImages.push("https://placekitten.com/256/256");
        }
      }

      setImages(fetchedImages);

      const utterance = new SpeechSynthesisUtterance(storyText);
      utterance.lang = getLangCode(language);
      utterance.voice = speechSynthesis.getVoices().find(v => v.lang === utterance.lang) || null;
      utterance.onend = () => setIsPaused(false);
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function stopSpeech() {
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    setIsPaused(false);
  }

  function startListening() {
    if (recognitionRef.current) {
      setListening(true);
      recognitionRef.current.lang = getLangCode(language);
      recognitionRef.current.start();
    }
  }

  function togglePauseResume() {
    if (speechSynthesis.speaking) {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        setIsPaused(false);
      } else {
        speechSynthesis.pause();
        setIsPaused(true);
      }
    }
  }

  function clearAll() {
    stopSpeech();
    setPrompt("");
    setStory("");
    setImages([]);
    setIsPaused(false);
    setIsStoryGenerated(false);
    setInputsDisabled(false);
  }

  function downloadStory() {
    const blob = new Blob([story], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "story.txt";
    link.click();
  }

  const storyParagraphs = story.split(/\n+/).filter(p => p.trim());

  return (
    <div style={{ maxWidth: 700, margin: "auto", padding: 20, fontFamily: "Arial" }}>
      <h1>🎙️ AI Story Buddy 🌟</h1>

      <label>
        Select Language:{" "}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={inputsDisabled || isStoryGenerated}
          style={{ padding: 6, marginBottom: 10 }}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
        </select>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A monkey and a mouse adventure"
          disabled={inputsDisabled}
          style={{ flex: 1, padding: 8, fontSize: 16 }}
        />
        <button
          onClick={startListening}
          disabled={inputsDisabled || listening}
          style={{ fontSize: 20, padding: "8px 12px", cursor: "pointer" }}
        >
          🎤
        </button>
      </div>

      <button
        onClick={generateStoryAndImages}
        disabled={!prompt.trim() || loading || inputsDisabled}
        style={{
          padding: "10px 20px",
          fontSize: 16,
          backgroundColor: "#007acc",
          color: "white",
          borderRadius: 6,
          marginRight: 10,
        }}
      >
        {loading ? "Generating..." : "Generate Story"}
      </button>

      {isStoryGenerated && (
        <>
          {/* <button
            onClick={stopSpeech}
            style={{
              padding: "10px 20px",
              fontSize: 16,
              backgroundColor: "#cc3300",
              color: "white",
              borderRadius: 6,
              marginRight: 10,
            }}
          >
            ⏹️ Stop
          </button> */}

          <button
            onClick={togglePauseResume}
            style={{
              padding: "10px 20px",
              fontSize: 16,
              backgroundColor: "#999900",
              color: "white",
              borderRadius: 6,
              marginRight: 10,
            }}
          >
            {isPaused ? "▶️ Resume" : "⏸️ Pause"}
          </button>

          <button
            onClick={downloadStory}
            style={{
              padding: "10px 20px",
              fontSize: 16,
              backgroundColor: "#2c7",
              color: "white",
              borderRadius: 6,
              marginRight: 10,
            }}
          >
            📥 Download
          </button>

          <button
            onClick={clearAll}
            style={{
              padding: "10px 20px",
              fontSize: 16,
              backgroundColor: "#999",
              color: "white",
              borderRadius: 6,
            }}
          >
            🧹 Clear
          </button>
        </>
      )}

      {story && (
        <div style={{ marginTop: 24 }}>
          <h2>Story:</h2>
          <div style={{ fontSize: 18, lineHeight: 1.6 }}>
            {storyParagraphs.map((para, i) => (
              <React.Fragment key={i}>
                <p>{para}</p>
                {i < images.length && (
                  <img
                    src={images[i]}
                    alt={`Illustration ${i + 1}`}
                    style={{
                      width: "100%",
                      maxHeight: 256,
                      borderRadius: 8,
                      marginBottom: 20,
                      objectFit: "cover",
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
