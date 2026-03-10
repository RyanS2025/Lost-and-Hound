import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, TextField, Button, Select, MenuItem,
  FormControl, InputLabel, Chip, CircularProgress, Modal, Slider,
  IconButton, InputAdornment, Collapse,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import UploadIcon from "@mui/icons-material/UploadFile";
import MapIcon from "@mui/icons-material/PinDrop";
import FlagIcon from "@mui/icons-material/Flag";
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import ReportModal from "../components/ReportModal";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";
import { CAMPUSES } from "../constants/campuses";

export default function DashboardPage() {
  return <div>Dashboard coming soon</div>;
}
