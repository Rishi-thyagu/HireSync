// ========================
// CONFIG
// ========================
const GROQ_API_KEY = "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";
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";

// ========================
// PDF EXTRACTOR
// ========================
async function extractPDF(input, targetId) {
  const file = input.files[0];
  if (!file) return;

  const hintId = input.id.replace('-pdf', '-pdf-hint');
  const hint = document.getElementById(hintId);
  const textarea = document.getElementById(targetId);

  hint.textContent = '⏳ Reading PDF...';

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }

    textarea.value = fullText.trim();
    hint.textContent = `✅ ${file.name} loaded`;
  } catch (e) {
    hint.textContent = '⚠️ Failed — paste manually';
  }
}

// ========================
// PAGE NAVIGATION
// ========================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ========================
// GROQ API CALL
// ========================
async function callGroq(systemPrompt, userMessage, loaderText = "Analyzing...") {
  showLoader(loaderText);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 1500,
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "API error");
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    return `⚠️ Error: ${e.message}. Check your API key or network connection.`;
  } finally {
    hideLoader();
  }
}

// ========================
// LOADER
// ========================
function showLoader(text = "Analyzing...") {
  document.getElementById('loader-text').textContent = text;
  document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loader').classList.add('hidden');
}

// ========================
// RENDER RESULT
// ========================
function showResult(boxId, html) {
  const box = document.getElementById(boxId);
  box.classList.remove('hidden');
  box.innerHTML = html;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========================
// MARKDOWN → HTML (simple)
// ========================
function md(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ========================
// 1. JD MATCHER
// ========================
async function runJDMatcher() {
  const resume = document.getElementById('jd-resume').value.trim();
  const jd     = document.getElementById('jd-jd').value.trim();

  if (!resume || !jd) {
    alert("Please paste both your resume and the job description.");
    return;
  }

  const system = `You are a career expert and recruiter with 15+ years of experience.
Analyze how well a candidate's resume matches a given job description.
Respond in this EXACT format (use the headings exactly):

MATCH SCORE: [number 0-100]%

STRONG MATCHES:
- [skill or experience that matches well]
- (list 3–5 bullet points)

MISSING / GAPS:
- [skill, experience, or keyword missing from resume]
- (list 3–5 bullet points)

KEYWORDS TO ADD:
- [important keywords from JD not in resume]
- (list 5–8 keywords)

VERDICT:
[2–3 sentence honest summary of the candidate's chances and what to do next]`;

  const user = `RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jd}`;

  const raw = await callGroq(system, user, "Matching your resume...");

  // Parse score
  const scoreMatch = raw.match(/MATCH SCORE:\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const scoreColor = score >= 75 ? '#00d4aa' : score >= 50 ? '#7c6dff' : '#ff6b6b';

  let html = '';
  if (score !== null) {
    html += `<div class="score-row">
      <div>
        <div class="score-big" style="color:${scoreColor}">${score}%</div>
        <div class="score-label">Match Score</div>
      </div>
      <div style="color:var(--muted);font-size:0.85rem;padding-bottom:6px">
        ${score >= 75 ? '✅ Strong match — apply with confidence' : score >= 50 ? '⚡ Decent match — customize before applying' : '⚠️ Weak match — significant gaps to address'}
      </div>
    </div>`;
  }

  html += md(raw.replace(/MATCH SCORE:\s*\d+%?/i, '').trim());
  showResult('jd-result', html);
}

// ========================
// 2. RESUME RATER
// ========================
async function runResumeRater() {
  const resume = document.getElementById('rr-resume').value.trim();
  const role   = document.getElementById('rr-role').value.trim();

  if (!resume) {
    alert("Please paste your resume.");
    return;
  }

  const system = `You are a senior recruiter and career coach.
Rate the given resume honestly and helpfully.
Respond in this EXACT format:

OVERALL SCORE: [number 0-100]

CATEGORY SCORES:
- Impact & Achievements: [X/25]
- Clarity & Readability: [X/25]
- Structure & Formatting: [X/25]
- Keywords & ATS fit: [X/25]

STRENGTHS:
- [what the resume does well]
- (3–4 bullet points)

IMPROVEMENTS:
- [specific, actionable change]
- (4–5 bullet points)

QUICK WINS:
- [easy change that makes a big difference]
- (2–3 bullet points)

SUMMARY:
[2-sentence honest summary]`;

  const userMsg = `${role ? `Target Role: ${role}\n\n` : ''}RESUME:\n${resume}`;

  const raw = await callGroq(system, userMsg, "Rating your resume...");

  const scoreMatch = raw.match(/OVERALL SCORE:\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const scoreColor = score >= 75 ? '#00d4aa' : score >= 50 ? '#7c6dff' : '#ff6b6b';

  let html = '';
  if (score !== null) {
    html += `<div class="score-row">
      <div>
        <div class="score-big" style="color:${scoreColor}">${score}<span style="font-size:1.5rem;letter-spacing:0;">/100</span></div>
        <div class="score-label">Resume Score</div>
      </div>
      <div style="color:var(--muted);font-size:0.85rem;padding-bottom:6px">
        ${score >= 75 ? '✅ Strong resume — minor polish needed' : score >= 50 ? '⚡ Average — needs meaningful improvements' : '⚠️ Needs significant work before applying'}
      </div>
    </div>`;
  }

  html += md(raw.replace(/OVERALL SCORE:\s*\d+/i, '').trim());
  showResult('rr-result', html);
}

// ========================
// 3. ATS CHECKER
// ========================
async function runATSChecker() {
  const resume = document.getElementById('ats-resume').value.trim();
  const jd     = document.getElementById('ats-jd').value.trim();

  if (!resume) {
    alert("Please paste your resume.");
    return;
  }

  const system = `You are an ATS (Applicant Tracking System) expert.
Analyze the given resume for ATS compatibility.
Respond in this EXACT format:

ATS SCORE: [number 0-100]%

PASSED CHECKS:
- [thing the resume does right for ATS]
- (3–5 points)

FAILED CHECKS:
- [ATS issue found in the resume]
- (3–5 points)

MISSING KEYWORDS:
- [keyword from JD or industry that ATS looks for but is absent]
- (5–8 keywords, or note if no JD was provided)

FORMAT ISSUES:
- [formatting problem that might break ATS parsing]
- (if none, write "No major format issues detected")

FIX PRIORITY:
- [most important fix to do first]
- [second fix]
- [third fix]

VERDICT:
[2-sentence honest summary]`;

  const userMsg = `RESUME:\n${resume}${jd ? `\n\nJOB DESCRIPTION:\n${jd}` : ''}`;

  const raw = await callGroq(system, userMsg, "Running ATS analysis...");

  const scoreMatch = raw.match(/ATS SCORE:\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const scoreColor = score >= 75 ? '#00d4aa' : score >= 50 ? '#7c6dff' : '#ff6b6b';

  let html = '';
  if (score !== null) {
    html += `<div class="score-row">
      <div>
        <div class="score-big" style="color:${scoreColor}">${score}%</div>
        <div class="score-label">ATS Score</div>
      </div>
      <div style="color:var(--muted);font-size:0.85rem;padding-bottom:6px">
        ${score >= 75 ? '✅ Likely passes most ATS systems' : score >= 50 ? '⚡ May pass — fix flagged issues first' : '⚠️ High chance of rejection by ATS'}
      </div>
    </div>`;
  }

  html += md(raw.replace(/ATS SCORE:\s*\d+%?/i, '').trim());
  showResult('ats-result', html);
}

// ========================
// 4. COVER LETTER
// ========================
async function runCoverLetter() {
  const resume  = document.getElementById('cl-resume').value.trim();
  const jd      = document.getElementById('cl-jd').value.trim();
  const name    = document.getElementById('cl-name').value.trim() || "the applicant";
  const company = document.getElementById('cl-company').value.trim() || "the company";
  const tone    = document.getElementById('cl-tone').value;

  if (!resume || !jd) {
    alert("Please paste your resume and the job description.");
    return;
  }

  const toneGuide = {
    professional: "formal, confident, and polished",
    enthusiastic: "energetic, passionate, and warm",
    concise:      "brief, direct, and to the point — 3 short paragraphs max",
    creative:     "distinctive, memorable, and slightly unconventional — show personality"
  }[tone];

  const system = `You are an expert cover letter writer who has helped 10,000+ people land jobs at top companies.
Write a ${toneGuide} cover letter.
The letter should:
- Open with something compelling, not "I am writing to apply..."
- Connect the candidate's actual experience to the specific role
- Show genuine understanding of what the company does
- End with a confident, clear call to action
- Be 3–4 paragraphs, under 350 words
- Sound human and specific, not generic
Output ONLY the cover letter text. No commentary, no subject line, no metadata.`;

  const userMsg = `Candidate Name: ${name}
Company: ${company}

RESUME / BACKGROUND:
${resume}

JOB DESCRIPTION:
${jd}`;

  const raw = await callGroq(system, userMsg, "Writing your cover letter...");

  const html = `
    <div class="result-actions">
      <button class="copy-btn" onclick="copyText(\`${raw.replace(/`/g, '\\`')}\`)">📋 Copy Letter</button>
    </div>
    <div style="white-space:pre-wrap;line-height:1.8;font-size:0.9rem;">${raw}</div>
  `;
  showResult('cl-result', html);
}

// ========================
// COPY TO CLIPBOARD
// ========================
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    if (btn) {
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy Letter'; }, 2000);
    }
  });
}

// ========================
// PREVENT DEFAULT on all href="#"
// ========================
document.addEventListener('click', e => {
  const a = e.target.closest('a[href="#"]');
  if (a) e.preventDefault();
});