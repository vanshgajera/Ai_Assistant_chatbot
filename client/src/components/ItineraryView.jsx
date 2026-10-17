import { motion } from "framer-motion";

const COLORS = { stay: "#ff7a3d", food: "#ffb347", transport: "#7fd1b9", activities: "#a78bfa" };
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function ItineraryView({ plan }) {
  const b = plan.breakdown || {};
  const total = Object.values(b).reduce((a, v) => a + Number(v || 0), 0) || 1;

  return (
    <motion.div className="result" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
      <div className="eyebrow">Your trip to {plan.destination}</div>
      <h2>{plan.title}</h2>
      <p className="sum">{plan.summary}</p>

      <div className="stats">
        <div className="stat"><b>{plan.days?.length}</b><span>Days</span></div>
        <div className="stat"><b>{inr(plan.totalCost)}</b><span>Estimated cost</span></div>
        <div className="stat"><b style={{ fontSize: "1.15rem" }}>{plan.bestTime}</b><span>Best time to visit</span></div>
      </div>

      <div>
        <div className="budget-bar">
          {Object.entries(b).map(([k, v]) => (
            <div key={k} style={{ width: `${(Number(v) / total) * 100}%`, background: COLORS[k] }} />
          ))}
        </div>
        <div className="legend">
          {Object.entries(b).map(([k, v]) => (
            <span key={k}><i style={{ background: COLORS[k] }} />{k} · {inr(v)}</span>
          ))}
        </div>
      </div>

      <div className="timeline">
        {plan.days?.map((d, i) => (
          <motion.div className="day" key={d.day}
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}>
            <div className="day-card">
              <div className="day-head">
                <h3>Day {d.day} · {d.title}</h3>
                <small>{inr(d.cost)}</small>
              </div>
              {d.activities?.map((a, j) => (
                <div className="act" key={j}>
                  <div className="em">{a.emoji || "📍"}</div>
                  <div>
                    <div className="t">{a.time}</div>
                    <h4>{a.name}</h4>
                    <p>{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="two-col">
        <div className="box">
          <h4>🎒 Packing list</h4>
          <ul>{plan.packing?.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
        <div className="box">
          <h4>💡 Local tips</h4>
          <ul>{plan.tips?.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      </div>
    </motion.div>
  );
}
