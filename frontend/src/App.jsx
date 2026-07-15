import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import Navbar from "./components/Navbar.jsx";
import BgGradient from "./components/BgGradient.jsx";
import PoolList from "./routes/PoolList.jsx";
import CreatePool from "./routes/CreatePool.jsx";
import PoolDetail from "./routes/PoolDetail.jsx";
import Landing from "./routes/Landing.jsx";
import HowItWorks from "./routes/HowItWorks.jsx";
import Leaderboard from "./routes/Leaderboard.jsx";

function AppContent() {
  const { isConnected } = useAccount();

  return (
    <>
      <BgGradient />
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-5xl w-full mx-auto">
          <Routes>
            <Route
              path="/"
              element={
                isConnected
                  ? <Navigate to="/pools" replace />
                  : <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      <Landing />
                    </motion.div>
              }
            />
            <Route path="/pools" element={
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <PoolList />
              </motion.div>
            } />
            <Route path="/create" element={
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <CreatePool />
              </motion.div>
            } />
            <Route path="/pool/:id" element={
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <PoolDetail />
              </motion.div>
            } />
            <Route path="/how-it-works" element={
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <HowItWorks />
              </motion.div>
            } />
            <Route path="/leaderboard" element={
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <Leaderboard />
              </motion.div>
            } />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
