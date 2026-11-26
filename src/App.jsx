import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { Plane, House, Plus, LogOut, ArrowDownLeft, ArrowUpRight, X, RefreshCw, Wallet } from "lucide-react";

const HOUSEHOLD_ID = "7e7fd02e-4e48-4264-9743-ae16a2ea0444";
const money = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
const icons = { Travel: Plane, Home: House };

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [goals, setGoals] = useState([]);
  const [role, setRole] = useState("viewer");
  const [selected, setSelected] = useState(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [showTransaction, setShowTransaction] = useState(false);
  const [transactionType, setTransactionType] = useState("deposit");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) loadData();
    else { setGoals([]); setSelected(null); }
  }, [session]);

  async function loadData() {
    setLoading(true);
    setError("");
    const user = session.user;
    const { data: membership, error: memberError } = await supabase
      .from("household_members")
      .select("role")
      .eq("household_id", HOUSEHOLD_ID)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      console.error("Membership check:", {
        userId: user.id,
        memberError,
        membership
      });
      setError(
        memberError
          ? `Membership error: ${memberError.message}`
          : `No membership found for user: ${user.id}`
      );
      setLoading(false);
      return;
    }
    setRole(membership.role);
    const { data, error: goalsError } = await supabase
      .from("goals")
      .select("id, name, target_amount, created_at, goal_transactions(id, amount, transaction_type, created_at)")
      .eq("household_id", HOUSEHOLD_ID)
      .order("created_at", { ascending: true });

    if (goalsError) setError(goalsError.message);
    else {
      const normalized = (data || []).map(g => ({
        ...g,
        transactions: [...(g.goal_transactions || [])].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)),
        balance: (g.goal_transactions || []).reduce((sum, t) =>
          sum + (t.transaction_type === "deposit" ? Number(t.amount) : -Number(t.amount)), 0)
      }));
      setGoals(normalized);
      setSelected(current => current ? normalized.find(g => g.id === current.id) || null : null);
    }
    setLoading(false);
  }

  async function signIn(e) {
    e.preventDefault(); setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function addGoal(e) {
    e.preventDefault();
    if (!goalName.trim() || Number(goalTarget) <= 0) return;
    setBusy(true); setError("");
    const { error } = await supabase.from("goals").insert({
      household_id: HOUSEHOLD_ID, name: goalName.trim(), target_amount: Number(goalTarget)
    });
    if (error) setError(error.message);
    else { setGoalName(""); setGoalTarget(""); setShowGoalForm(false); await loadData(); }
    setBusy(false);
  }

  async function addTransaction(e) {
    e.preventDefault();
    const amount = Number(transactionAmount);
    if (!selected || amount <= 0) return;
    if (transactionType === "withdrawal" && amount > selected.balance) {
      setError("Withdrawal cannot be greater than the saved balance.");
      return;
    }
    setBusy(true); setError("");
    const { error } = await supabase.from("goal_transactions").insert({
      goal_id: selected.id, amount, transaction_type: transactionType, created_by: session.user.id
    });
    if (error) setError(error.message);
    else { setTransactionAmount(""); setShowTransaction(false); await loadData(); }
    setBusy(false);
  }

  async function deleteGoal(goal) {
    if (!window.confirm(`Delete "${goal.name}" and its transaction history?`)) return;
    const { error } = await supabase.from("goals").delete().eq("id", goal.id);
    if (error) setError(error.message);
    else { setSelected(null); await loadData(); }
  }

  if (!supabase) return <main className="center-screen"><section className="login-card"><h1>Rodi &amp; Bedo</h1><p>Add your Supabase settings to the <code>.env</code> file to start.</p></section></main>;
  if (loading && !session) return <main className="center-screen"><div className="loader"><RefreshCw className="spin" /> Loading</div></main>;

  if (!session) return (
    <main className="center-screen">
      <form className="login-card" onSubmit={signIn}>
        <div className="eyebrow">OUR SAVINGS</div>
        <h1>Rodi &amp; Bedo</h1>
        <p className="muted">Sign in to your shared savings space.</p>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );

  const totalSaved = goals.reduce((sum, g) => sum + g.balance, 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="eyebrow">OUR SAVINGS</div>
        <div className="brand">Rodi &amp; Bedo</div>
        <button className="icon-button logout" title="Sign out" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
      </header>

      <section className="summary-strip">
        <div><span className="muted">Total saved</span><strong>SAR {money(totalSaved)}</strong></div>
        <div className="role-pill">{isAdmin ? "Bedo · Admin" : "Rodi · View only"}</div>
      </section>

      {error && <div className="notice error">{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}

      <div className="section-heading">
        <h2>Our goals</h2>
        {isAdmin && <button className="primary add-button" onClick={()=>setShowGoalForm(true)}><Plus size={18}/> Add goal</button>}
      </div>

      {loading ? <div className="loader"><RefreshCw className="spin"/> Updating savings…</div> :
        goals.length === 0 ? <div className="empty-state"><Wallet size={32}/><h3>No savings goals yet</h3><p>Your shared goals will appear here once Bedo adds the first one.</p></div> :
        <div className="goal-list">
          {goals.map(goal => {
            const Icon = icons[goal.name] || Wallet;
            const pct = Math.min(100, Math.max(0, goal.balance / Number(goal.target_amount) * 100));
            return <button className="goal-card" key={goal.id} onClick={()=>setSelected(goal)}>
              <div className="goal-title"><span className="goal-icon"><Icon size={27}/></span><span>{goal.name}</span></div>
              <div className="amount"><span className="currency">SAR</span> {money(goal.balance)}</div>
              <div className="progress"><span style={{width:`${pct}%`}}/></div>
              <div className="target-line"><span>Target: {money(goal.target_amount)} SAR</span><span>{Math.round(pct)}%</span></div>
            </button>;
          })}
        </div>
      }
      <footer>Simple <span>•</span> Clean <span>•</span> Shared</footer>

      {selected && <div className="overlay" onClick={()=>setSelected(null)}>
        <section className="detail-modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-head"><div><div className="eyebrow">SAVINGS GOAL</div><h2>{selected.name}</h2></div><button className="icon-button" onClick={()=>setSelected(null)}><X/></button></div>
          <div className="detail-balance">SAR {money(selected.balance)}</div>
          <div className="muted">Target: {money(selected.target_amount)} SAR</div>
          <div className="progress detail-progress"><span style={{width:`${Math.min(100, Math.max(0, selected.balance/Number(selected.target_amount)*100))}%`}}/></div>
          {isAdmin && <div className="action-row">
            <button className="primary" onClick={()=>{setTransactionType("deposit");setShowTransaction(true)}}><ArrowDownLeft size={17}/> Add deposit</button>
            <button className="secondary" onClick={()=>{setTransactionType("withdrawal");setShowTransaction(true)}}><ArrowUpRight size={17}/> Withdraw</button>
          </div>}
          <h3 className="history-title">Transaction history</h3>
          {selected.transactions.length === 0 ? <p className="muted">No transactions yet.</p> :
            <div className="transactions">{selected.transactions.map(t=><div className="transaction" key={t.id}>
              <span className={`transaction-icon ${t.transaction_type}`} >{t.transaction_type==="deposit"?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span>
              <div className="transaction-info"><strong>{t.transaction_type==="deposit"?"Deposit":"Withdrawal"}</strong><small>{new Date(t.created_at).toLocaleDateString()}</small></div>
              <strong className={t.transaction_type==="deposit"?"positive":"negative"}>{t.transaction_type==="deposit"?"+":"−"}{money(t.amount)} SAR</strong>
            </div>)}</div>}
          {isAdmin && <button className="delete-link" onClick={()=>deleteGoal(selected)}>Delete this goal</button>}
        </section>
      </div>}

      {showGoalForm && <div className="overlay" onClick={()=>setShowGoalForm(false)}><form className="small-modal" onSubmit={addGoal} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h2>New savings goal</h2><button type="button" className="icon-button" onClick={()=>setShowGoalForm(false)}><X/></button></div>
        <label>Goal name<input value={goalName} onChange={e=>setGoalName(e.target.value)} placeholder="e.g. Travel" required/></label>
        <label>Target amount (SAR)<input type="number" min="0.01" step="0.01" value={goalTarget} onChange={e=>setGoalTarget(e.target.value)} placeholder="6000" required/></label>
        <button className="primary full" disabled={busy}>{busy?"Saving…":"Create goal"}</button>
      </form></div>}

      {showTransaction && <div className="overlay" onClick={()=>setShowTransaction(false)}><form className="small-modal" onSubmit={addTransaction} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h2>{transactionType==="deposit"?"Add deposit":"Record withdrawal"}</h2><button type="button" className="icon-button" onClick={()=>setShowTransaction(false)}><X/></button></div>
        <div className="type-switch"><button type="button" className={transactionType==="deposit"?"chosen":""} onClick={()=>setTransactionType("deposit")}>Deposit</button><button type="button" className={transactionType==="withdrawal"?"chosen":""} onClick={()=>setTransactionType("withdrawal")}>Withdrawal</button></div>
        <label>Amount (SAR)<input type="number" min="0.01" step="0.01" value={transactionAmount} onChange={e=>setTransactionAmount(e.target.value)} placeholder="500" required/></label>
        <button className="primary full" disabled={busy}>{busy?"Saving…":"Save transaction"}</button>
      </form></div>}
    </main>
  );
}
