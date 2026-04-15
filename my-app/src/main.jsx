import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext.jsx";
import { DemoProvider } from "./contexts/DemoContext.jsx";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import "./index.css";
import App from "./App.jsx";

// Custom theme with Northeastern colors
// --- theme: Custom MUI theme with Northeastern colors ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#A84D48', // Northeastern red
    },
    secondary: {
      main: '#1976d2',
    },
  },
  typography: {
    fontFamily: '"Nunito", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h4: {
      fontWeight: 700,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <DemoProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DemoProvider>
    </BrowserRouter>
  </ThemeProvider>
);