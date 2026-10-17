import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Sparkles, Search } from "lucide-react";
import ItineraryView from "./components/ItineraryView.jsx";
import ChatBot from "./components/ChatBot.jsx";

const MOODS = [
  { id: "adventure", label: "🏔️ Adventure" },
  { id: "chill", label: "🌴 Chill" },
  { id: "spiritual", label: "🕉️ Spiritual" },
  { id: "foodie", label: "🍜 Foodie" },
  { id: "romantic", label: "💞 Romantic" },
  { id: "budget backpacking", label: "🎒 Backpacker" },
];

const DESTINATIONS = [
  { name: "Manali", tag: "Himachal · Snow & trails", img: "photo-1626621341517-bbf3d9990a23" },
  { name: "Goa", tag: "Beaches · Cafes", img: "photo-1512343879784-a960bf40e7f2" },
  { name: "Rishikesh", tag: "Rafting · Yoga", img: "photo-1600100397608-f010f423b971" },
  { name: "Ladakh", tag: "High passes · Monasteries", img: "photo-1581793745862-99fde7fa73d2" },
];

export default function App() {
  const [form, setForm] = useState({ destination: "", days: 4, budget: 20000, travelers: 2 });
  const [mood, setMood] = useState("adventure");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef(null);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const generate = async (destOverride) => {
    const destination = (destOverride || form.destination).trim();
    if (!destination) return setError("Pehle destination likho 🙂");
    setError("");
    setLoading(true);
    setPlan(null);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiBase}/api/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, destination, mood }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kuch galat ho gaya");
      setPlan({ ...data, destination });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickDestination = (name) => {
    setForm((f) => ({ ...f, destination: name }));
    generate(name);
  };

  return (
    <>
      <header className="hero">
        <nav className="nav">
          <div className="logo"><Compass color="#ff7a3d" /> Wander<span>ly</span></div>
          <div className="nav-links">
            <a href="#explore">Explore</a>
            <a href="#plan">My Plan</a>
          </div>
          <button className="pill-btn">Sign in</button>
        </nav>

        <div className="container">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="hero-tag"><Sparkles size={15} /> Powered by Gemini AI</span>
            <h1>Your next <em>adventure</em>, planned in seconds.</h1>
            <p className="lead">
              Bas destination, budget aur mood batao. Wanderly tumhare liye day-wise itinerary,
              kharcha aur packing list bana dega.
            </p>

            <div className="glass" id="plan">
              <div className="fields">
                <div className="field">
                  <label>Where to?</label>
                  <input placeholder="Manali, Goa, Bali..." value={form.destination} onChange={update("destination")}
                    onKeyDown={(e) => e.key === "Enter" && generate()} />
                </div>
                <div className="field">
                  <label>Days</label>
                  <input type="number" min="1" max="14" value={form.days} onChange={update("days")} />
                </div>
                <div className="field">
                  <label>Budget (₹)</label>
                  <input type="number" min="1000" step="1000" value={form.budget} onChange={update("budget")} />
                </div>
                <div className="field">
                  <label>Travellers</label>
                  <input type="number" min="1" max="20" value={form.travelers} onChange={update("travelers")} />
                </div>
                <button className="go-btn" onClick={() => generate()} disabled={loading}>
                  <Search size={18} /> {loading ? "Planning..." : "Plan trip"}
                </button>
              </div>
              <div className="moods">
                {MOODS.map((m) => (
                  <button key={m.id} className={`chip ${mood === m.id ? "active" : ""}`} onClick={() => setMood(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
              {error && <p style={{ marginTop: 14, color: "#ffd2bd" }}>⚠️ {error}</p>}
            </div>
          </motion.div>
        </div>
      </header>

      <section className="block" id="explore">
        <div className="container">
          <div className="eyebrow">Popular right now</div>
          <h2 className="title">Pick a place, we'll handle the rest.</h2>
          <div className="dest-grid">
            {DESTINATIONS.map((d, i) => (
              <motion.div key={d.name} className="dest" onClick={() => pickDestination(d.name)}
                initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}>
                <img src={`https://images.unsplash.com/${d.img}?auto=format&fit=crop&w=700&q=80`} alt={d.name} />
                <div className="info"><h3>{d.name}</h3><span>{d.tag}</span></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 40 }} ref={resultRef}>
        <div className="container">
          {loading && (
            <div className="loader">
              <div className="plane">✈️</div>
              <h3>Wanderly tumhari trip bana raha hai...</h3>
            </div>
          )}
          {plan && <ItineraryView plan={plan} />}
        </div>
      </section>

      <footer>Made with ❤️ using React, Express & Gemini</footer>

      <ChatBot tripContext={plan ? `${plan.title} (${plan.destination})` : ""} />
    </>
  );
}
