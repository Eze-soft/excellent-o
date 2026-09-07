require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const featuredJobsPath = path.join(__dirname, 'featured-jobs.json');

function readFeaturedJobs() {
    if (!fs.existsSync(featuredJobsPath)) return [];
    const data = fs.readFileSync(featuredJobsPath, 'utf8');
    return data.trim() ? JSON.parse(data) : [];
}

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.error('Missing ADZUNA_APP_ID or ADZUNA_APP_KEY environment variables. Set them before starting the server.');
    process.exit(1);
}

app.use(express.json());
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Mock job data
const jobs = [
    { id: 1, title: 'Head Chef', category: 'Care & Health', location: 'Ireland / Europe', description: 'Seasonal culinary leadership role. Open for international applicants requiring visa support.' },
    { id: 2, title: 'HealthCare Assistant Responder', category: 'Care & Health', location: 'Ireland / UK', description: 'Assisting in clinical and operational tasks, patient care support.' },
    { id: 3, title: 'Farm Worker', category: 'Agriculture', location: 'Canada', description: 'Seasonal farm duties, fruit picking, and crop management.' }
];

// Serve index.html directly from the root folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to return job listings
app.get('/api/jobs', (req, res) => {
    const { keyword, country } = req.query;
    let filteredJobs = jobs;

    if (keyword) {
        filteredJobs = filteredJobs.filter(job =>
            job.title.toLowerCase().includes(String(keyword).toLowerCase()) ||
            job.description.toLowerCase().includes(String(keyword).toLowerCase())
        );
    }

    if (country) {
        filteredJobs = filteredJobs.filter(job =>
            job.location.toLowerCase().includes(String(country).toLowerCase())
        );
    }

    res.json(filteredJobs);
});

app.get('/api/featured-jobs', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        res.json(readFeaturedJobs());
    } catch (error) {
        res.status(500).json({ error: 'Failed to read featured jobs' });
    }
});

app.post('/api/post-job', (req, res) => {
    const newJob = req.body;
    if (!newJob || !newJob.title || !newJob.company || !newJob.location || !newJob.description) {
        return res.status(400).json({ error: 'Job title, company, location, and description are required' });
    }

    try {
        const jobs = readFeaturedJobs();

        jobs.unshift({ ...newJob, postedAt: new Date().toISOString() });
        const tempPath = featuredJobsPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(jobs, null, 2));
        fs.renameSync(tempPath, featuredJobsPath);
        res.json({ success: true, message: 'Featured job posted successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save featured job' });
    }
});

// Proxy the live Adzuna feed so browser requests are not blocked by CORS.
app.get('/api/live-jobs', async (req, res) => {
    const country = req.query.country || 'gb';
    const keyword = req.query.keyword || 'job';
    const city = req.query.city || '';
    let adzunaUrl = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=6&what=${encodeURIComponent(keyword)}`;
    if (city) adzunaUrl += `&where=${encodeURIComponent(city)}`;

    try {
        const response = await fetch(adzunaUrl, { signal: AbortSignal.timeout(10000) });
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            data = { error: 'Adzuna returned a non-JSON response' };
        }
        res.status(response.status).json(data);
    } catch (error) {
        res.status(502).json({ error: "Failed to fetch from Adzuna" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});