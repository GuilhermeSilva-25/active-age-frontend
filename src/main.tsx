import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { setupAuthFetchInterceptor } from "./api/authFetch";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./index.css";

// Ativa o interceptor de autenticacao JWT
setupAuthFetchInterceptor();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
