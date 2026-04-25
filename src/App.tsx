import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Privacidade } from "./pages/Privacidade";
import { Termos } from "./pages/Termos";
import { Servicos } from "./pages/Servicos";
import { QuemSomos } from "./pages/QuemSomos";
import { Cadastro } from "./pages/Cadastro";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/servicos" element={<Servicos />} />
        <Route path="/quem-somos" element={<QuemSomos />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;
