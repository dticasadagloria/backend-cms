import express from "express";
import { criarRestauracao, listarRestauracoes, atualizarStatusRestauracao } from "../controllers/restauracoesController.js";

const router = express.Router();

router.post("/", criarRestauracao); // Criar nova restauração
router.get("/", listarRestauracoes); // Listar todas
router.put("/:id", atualizarStatusRestauracao); // Atualizar status

export default router;