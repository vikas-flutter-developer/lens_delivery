import express from 'express';
import { getSuggestions, learnSuggestions, deleteSuggestion } from '../controllers/suggestion.controller.js';

const router = express.Router();

router.get('/', getSuggestions);
router.post('/learn', learnSuggestions);
router.post('/delete', deleteSuggestion); // Changed from delete to post/delete to match frontend and avoid body issues

export default router;
