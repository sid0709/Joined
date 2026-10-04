import { createTheme, alpha } from "@mui/material/styles";

const primary = "#7c6ef5";
const background = "#07070d";
const paper = "#0d0d18";
const secondary = "#131322";
const mutedForeground = "#6b6b88";
const border = "rgba(255, 255, 255, 0.06)";

export const athensDisplayFont = '"Bricolage Grotesque", "Figtree", system-ui, sans-serif';

export const athensCardSx = {
  p: 2.5,
  borderRadius: 3,
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.24)",
};

export const athensSectionLabelSx = {
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "text.secondary",
};

export const athensPageTitleSx = {
  fontFamily: athensDisplayFont,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

export function createAthensTheme() {
  return createTheme({
    palette: {
      mode: "dark",
      primary: {
        main: primary,
        light: "#9b87f7",
        dark: "#6c5ce7",
        contrastText: "#ffffff",
      },
      secondary: {
        main: secondary,
        contrastText: "#eeeef6",
      },
      background: {
        default: background,
        paper,
      },
      text: {
        primary: "#eeeef6",
        secondary: mutedForeground,
      },
      error: {
        main: "#f87171",
      },
      success: {
        main: "#34d399",
      },
      warning: {
        main: "#fbbf24",
      },
      divider: border,
      action: {
        hover: alpha(primary, 0.08),
        selected: alpha(primary, 0.12),
      },
    },
    typography: {
      fontFamily: '"Figtree", system-ui, -apple-system, sans-serif',
      h4: {
        fontFamily: athensDisplayFont,
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h5: {
        fontFamily: athensDisplayFont,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        fontSize: "1.15rem",
      },
      h6: {
        fontFamily: athensDisplayFont,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        fontSize: "0.95rem",
      },
      subtitle1: {
        fontWeight: 600,
      },
      button: {
        fontWeight: 700,
        textTransform: "none",
        fontSize: "0.8125rem",
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: background,
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.12) transparent",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: "10px 16px",
            minHeight: 40,
            boxShadow: "none",
          },
          contained: {
            boxShadow: "0 4px 20px rgba(124, 110, 245, 0.22)",
            "&:hover": {
              boxShadow: "0 6px 24px rgba(124, 110, 245, 0.3)",
            },
            "&:disabled": {
              boxShadow: "none",
            },
          },
          containedSuccess: {
            boxShadow: "0 4px 20px rgba(52, 211, 153, 0.18)",
            "&:hover": {
              boxShadow: "0 6px 24px rgba(52, 211, 153, 0.26)",
            },
          },
          containedError: {
            boxShadow: "0 4px 20px rgba(248, 113, 113, 0.18)",
          },
          outlined: {
            borderColor: border,
            color: "#eeeef6",
            "&:hover": {
              borderColor: alpha(primary, 0.45),
              backgroundColor: alpha(primary, 0.08),
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: paper,
            border: `1px solid ${border}`,
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.24)",
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 44,
          },
          indicator: {
            display: "none",
          },
          flexContainer: {
            gap: 6,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 40,
            minWidth: 0,
            flex: 1,
            borderRadius: 12,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.8125rem",
            color: mutedForeground,
            transition: "background-color 0.15s ease, color 0.15s ease",
            "&.Mui-selected": {
              color: primary,
              fontWeight: 700,
              backgroundColor: alpha(primary, 0.1),
            },
            "&:hover": {
              color: "#eeeef6",
              backgroundColor: alpha("#ffffff", 0.04),
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: secondary,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: border,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(primary, 0.35),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(primary, 0.5),
              boxShadow: `0 0 0 3px ${alpha(primary, 0.18)}`,
            },
          },
          input: {
            padding: "10px 14px",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: "0.75rem",
            fontWeight: 600,
            color: mutedForeground,
            "&.Mui-focused": {
              color: primary,
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            minHeight: 40,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: "2px 6px",
            fontSize: "0.875rem",
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: border,
          },
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          root: {
            color: primary,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: "#1a1a2e",
            border: `1px solid ${border}`,
            borderRadius: 10,
            fontSize: "0.75rem",
            padding: "8px 12px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.32)",
          },
          arrow: {
            color: "#1a1a2e",
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${border}`,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.32)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${border}`,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: athensDisplayFont,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          },
        },
      },
    },
  });
}
