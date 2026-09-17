import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from "@mui/material";
import { ApiError, login } from "../services/api";

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await login(username.trim(), password);
      localStorage.setItem("access_token", response.access_token);
      await onLogin();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Invalid username or password." : err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="login-page">
      <Paper className="login-card" elevation={2}>
        <Box className="brand-mark">F</Box>
        <Typography variant="h4" fontWeight={700}>Noviga Fractal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Timeline Dashboard</Typography>
        <Box component="form" onSubmit={submit}>
          <TextField fullWidth label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" sx={{ mb: 2 }} />
          <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 3, height: 48 }}>
            {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
