import express from "express";
import cors from "cors";
import { supabase } from "./supabaseClient";

const app = express();

app.use(cors({ orgin: "http://localhost:5173/" }));
app.use(express.json());

//app.get();