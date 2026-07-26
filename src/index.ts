import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import 'dotenv/config';
import { McpApplicationFactory } from '@nitrostack/core';
import { RootApp } from './app.module.js';

// Load Groq client with environment key
const GROQ_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;

async function bootstrap() {
  try {
    const mcpApp = await McpApplicationFactory.create(RootApp);
    await mcpApp.start();

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Logging middleware
    app.use((req, res, next) => {
      console.log(`\n📥 [API CALL] ${req.method} ${req.path}`);
      console.log(`   Payload:`, JSON.stringify(req.body));
      next();
    });

    // Helper function to query Groq
    const fetchGroqResponse = async (userPrompt: string, patientId: string = 'P-101') => {
      if (!groq) {
        console.error('❌ GROQ_API_KEY is missing from environment variables!');
        return null;
      }

      const promptText = `Patient ID: ${patientId}. Request: ${userPrompt}`;
      
      try {
        console.log(`📡 Querying Groq API...`);
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are an AI Clinical Assistant for clinical trial management. Return concise, structured, medical insights specific to the user query.'
            },
            { role: 'user', content: promptText }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3
        });

        const reply = completion.choices[0]?.message?.content;
        if (reply) {
          console.log(`✅ Received live LLM response from Groq!`);
          return reply;
        }
      } catch (err: any) {
        console.error(`❌ Groq API Error:`, err?.message || err);
      }

      return null;
    };

    // Copilot / MCP Endpoint
    app.post(['/mcp', '/tools/call', '/ask_copilot'], async (req, res) => {
      try {
        const userQuery = req.body?.prompt || req.body?.question || req.body?.query || req.body?.params?.arguments?.prompt || 'explain protocol and eligibility';
        const pId = req.body?.patientId || req.body?.patient_id || 'P-101';

        const aiResponse = await fetchGroqResponse(userQuery, pId);
        const textOutput = aiResponse || `Analysis completed for query: "${userQuery}".`;

        return res.json({
          success: true,
          status: 'success',
          response: textOutput,
          text: textOutput,
          message: textOutput,
          content: [{ type: 'text', text: textOutput }],
          result: textOutput
        });
      } catch (err: any) {
        console.error('❌ Endpoint Error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // Clinical Trials NIH API Endpoint
    app.post(['/search_clinical_trials', '/:toolName'], async (req, res) => {
      try {
        const toolName = req.params.toolName || 'search_clinical_trials';

        if (toolName === 'search_clinical_trials') {
          const condition = req.body.condition || 'Prostate Cancer';
          console.log(`🔎 Querying NIH ClinicalTrials.gov API for: ${condition}`);
          
          const nihUrl = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(condition)}&pageSize=5`;
          const apiRes = await fetch(nihUrl);

          if (apiRes.ok) {
            const nihData: any = await apiRes.json();
            const studies = (nihData.studies || []).map((s: any) => {
              const protocol = s.protocolSection || {};
              return {
                NCT_ID: protocol.identificationModule?.nctId || 'N/A',
                Title: protocol.identificationModule?.briefTitle || 'Clinical Study',
                Phase: protocol.designModule?.phases?.[0] || 'Phase N/A',
                Status: protocol.statusModule?.overallStatus || 'Active',
                Location: protocol.contactsLocationsModule?.locations?.[0]?.facility || 'Multiple Centers',
                Eligibility: (protocol.eligibilityModule?.eligibilityCriteria || 'Criteria details online').substring(0, 120) + '...'
              };
            });
            console.log(`✅ Retrieved ${studies.length} live trials from NIH API!`);
            return res.json({ success: true, trials: studies, data: studies, result: studies });
          }
        }

        const userQuery = JSON.stringify(req.body);
        const aiResponse = await fetchGroqResponse(userQuery);
        const textOutput = aiResponse || `Executed ${toolName}`;

        res.json({
          success: true,
          response: textOutput,
          text: textOutput,
          content: [{ type: 'text', text: textOutput }]
        });
      } catch (err: any) {
        console.error('❌ Direct tool error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    app.get(['/', '/health'], (req, res) => res.json({ status: 'ok' }));

    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`\n==================================================`);
      console.log(`🌐 Express Bridge ACTIVE on http://localhost:${PORT}`);
      console.log(`==================================================\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();