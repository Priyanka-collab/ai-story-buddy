import React, { useState, useEffect, useRef } from "react";
import "../styles.css";

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
  const [language, setLanguage] = useState("en");
  const [model, setModel] = useState("deepseek/deepseek-chat-v3-0324");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [inputsDisabled, setInputsDisabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStoryGenerated, setIsStoryGenerated] = useState(false);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY!;
  const unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY!;

  const getLangCode = (lang: string) =>
    lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : "en-US";

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
          model,
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
      speechSynthesis.cancel(); // ensure no other speech running
      speechSynthesis.speak(utterance);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function stopSpeech() {
    if (speechSynthesis.speaking || speechSynthesis.paused) {
      speechSynthesis.cancel();
    }
    setIsPaused(false);
  }

  function togglePauseResume() {
  if (!utteranceRef.current) return;

  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    setIsPaused(true);
  } else if (speechSynthesis.paused) {
    speechSynthesis.resume();
    setIsPaused(false);
  }
}


  function startListening() {
    if (recognitionRef.current) {
      setListening(true);
      recognitionRef.current.lang = getLangCode(language);
      recognitionRef.current.start();
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
    <div className="app-wrapper">
      <div className="story-container">
        <h1>🌈 AI Story Buddy 📚</h1>
        <div className="instructions">
          <strong>How to Use:</strong>
          <ul>
            <li>Select your preferred language and AI model.</li>
            <li>Type or speak your story topic using 🎤.</li>
            <li>Click “Generate Story” to hear and see your tale!</li>
            <li>Use ⏸️/▶️ to pause or resume narration.</li>
            <li>Download or clear when you're done!</li>
          </ul>
        </div>

        <div className="controls">
          <label>
            🌍 Language:
            <div className="dropdown-wrapper">
              <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={inputsDisabled || isStoryGenerated}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="te">Telugu</option>
              </select>
            </div>
          </label>

          <label>
            🧠 Model:
            <div className="dropdown-wrapper">
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={inputsDisabled || isStoryGenerated}>
                <option value="deepseek/deepseek-chat-v3-0324">DeepSeek (free)</option>
                <option value="mistralai/mistral-7b-instruct">Mistral 7B</option>
                <option value="nousresearch/nous-capybara-7b:free">Nous Capybara</option>
                <option value="huggingfaceh4/zephyr-7b-beta">Zephyr 7B</option>
                <option value="openchat/openchat-3.5-1210">OpenChat 3.5</option>
                <option value="gryphe/mythomax-l2-13b">MythoMax L2</option>
                <option value="neuralbeagle/neuralbeagle-7b">NeuralBeagle</option>
              </select>
            </div>
          </label>
        </div>

        <div className="prompt-area">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A giraffe who loved rainbows"
            disabled={inputsDisabled}
          />
          <button onClick={startListening} disabled={inputsDisabled || listening}>🎤</button>
        </div>

        <button className="generate-btn" onClick={generateStoryAndImages} disabled={!prompt.trim() || loading || inputsDisabled}>
          {loading ? "✨ Generating..." : "📖 Generate Story"}
        </button>

        {isStoryGenerated && (
          <div className="action-buttons">
            <button onClick={togglePauseResume}>{isPaused ? "▶️ Resume" : "⏸️ Pause"}</button>
            <button onClick={downloadStory}>📥 Download</button>
            <button onClick={clearAll}>🧹 Clear</button>
          </div>
        )}

        {story && (
          <div className="story-display">
            <h2>📚 Your Story:</h2>
            {storyParagraphs.map((para, i) => (
              <React.Fragment key={i}>
                <p>{para}</p>
                {i < images.length && (
                  <img src={images[i]} alt={`Illustration ${i + 1}`} className="story-image" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
