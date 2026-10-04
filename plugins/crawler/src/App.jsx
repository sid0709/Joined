import { ThemeProvider, CssBaseline, Box } from "@mui/material";

import LayoutPage from "./components/layout";
import { createAthensTheme } from "./theme/athensTheme";

const athensTheme = createAthensTheme();

function App() {
  return (
    <ThemeProvider theme={athensTheme}>
      <CssBaseline />
      <Box
        className="subtle-scroll"
        sx={{
          minHeight: "100%",
          px: 1.5,
          py: 1.5,
          overflow: "auto",
        }}
      >
        <LayoutPage />
      </Box>
    </ThemeProvider>
  );
}

export default App;
