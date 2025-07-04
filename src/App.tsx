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
  const [language, setLanguage] = useState("en"); // 'en' or 'hi'
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [inputsDisabled, setInputsDisabled] = useState(false);

  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY!;
  const unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY!;
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = language === "hi" ? "hi-IN" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
    stopSpeech();

    try {
      const langName = language === "hi" ? "Hindi" : "English";

      const storyPrompt = `
You are a fun children's storyteller. Create a short story suitable for a 6-year-old in ${langName}.
Topic: ${prompt}
`;

      const storyRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct",
          messages: [{ role: "user", content: storyPrompt }],
        }),
      });

      const storyData = await storyRes.json();

      if (!storyRes.ok) throw new Error(storyData?.error?.message || "Story generation failed.");

      const storyText = storyData.choices[0].message.content;
      setStory(storyText);

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
      utterance.lang = language === "hi" ? "hi-IN" : "en-US";
      utterance.voice = speechSynthesis.getVoices().find(v => v.lang === utterance.lang) || undefined;
      speechSynthesis.speak(utterance);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
      setInputsDisabled(false);
    }
  }

  function startListening() {
    if (recognitionRef.current) {
      setListening(true);
      recognitionRef.current.lang = language === "hi" ? "hi-IN" : "en-US";
      recognitionRef.current.start();
    }
  }

  function stopSpeech() {
    if (speechSynthesis.speaking) speechSynthesis.cancel();
  }

  const storyParagraphs = story.split(/\n+/).filter(p => p.trim());

  return (
    <div style={{ maxWidth: 700, margin: "auto", padding: 20, fontFamily: "Arial" }}>
      <h1>AI Story Buddy 🌟</h1>

      <label>
        Select Language:{" "}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={inputsDisabled}
          style={{ padding: 6, marginBottom: 10 }}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>
      </label>

      <br />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
  <input
    type="text"
    value={prompt}
    onChange={(e) => setPrompt(e.target.value)}
    placeholder="e.g., A tiger who loved books"
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



      <br />

      <button
        onClick={generateStoryAndImages}
        disabled={inputsDisabled || !prompt.trim()}
        style={{
          marginTop: 12,
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

      <button
        onClick={stopSpeech}
        disabled={inputsDisabled || !story}
        style={{
          padding: "10px 20px",
          fontSize: 16,
          backgroundColor: "#cc3300",
          color: "white",
          borderRadius: 6,
        }}
      >
        Stop Narration
      </button>

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
