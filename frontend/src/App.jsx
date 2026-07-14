import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { AnimatePresence, motion } from "motion/react";
import Navbar from "./components/Navbar.jsx";
import BgGradient from "./components/BgGradient.jsx";
import PoolList from "./routes/PoolList.jsx";
import CreatePool from "./routes/CreatePool.jsx";
import PoolDetail from "./routes/PoolDetail.jsx";
import Landing from "./routes/Landing.jsx";

function AppContent() {
  const location = useLocation();
  const { isConnected } = useAccount();
  const showGradient = true;

  return (
    <>
      {showGradient && <BgGradient />}
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-5xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  isConnected
                    ? <Navigate to="/pools" replace />
                    : <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                        <Landing />
                      </motion.div>
                }
              />
              <Route path="/pools" element={
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                  <PoolList />
                </motion.div>
              } />
              <Route path="/create" element={
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                  <CreatePool />
                </motion.div>
              } />
              <Route path="/pool/:id" element={
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                  <PoolDetail />
                </motion.div>
              } />
            </Routes>
          </AnimatePresence>
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
