# IA-restful-AI-Project

A full-stack AI web application that integrates a RESTful API with a Hugging Face language model deployed on DigitalOcean, utilizing Supabase for backend services. The application is live at [elegant-faun-14186b.netlify.app](https://generate-lyrics.netlify.app/).

## Features

-   **Frontend**: Responsive web interface built with HTML, CSS, and JavaScript.
-   **Backend**: Node.js with Express.js providing RESTful API endpoints.
-   **AI Integration**: Utilizes Hugging Face models deployed via DigitalOcean's 1-Click HUGS (Hugging Face Generative AI Services) on GPU Droplets.
-   **Database**: Supabase for authentication, storage, and vector embeddings.
-   **Deployment**: Frontend hosted on Netlify; backend services and AI models hosted on DigitalOcean.

## Live Demo

Access the live application here: [elegant-faun-14186b.netlify.app](https://generate-lyrics.netlify.app/)

## Getting Started

### Prerequisites

-   Node.js (v14 or later)
-   npm (v6 or later)
-   Supabase account
-   DigitalOcean account with access to GPU Droplets

### Installation

1. **Clone the repository**:

    ```bash
    git clone https://github.com/mjwanless/IA-restful-AI-Project.git
    cd IA-restful-AI-Project
    ```

2. **Install backend dependencies**:

    ```bash
    cd backend
    npm install
    ```

3. **Install frontend dependencies**:

    ```bash
    cd ../frontend
    npm install
    ```

### Configuration

1. **Supabase**:

    - Set up a new project on Supabase.
    - Create necessary tables and storage buckets as per your application's requirements.
    - Obtain the API keys and database URL.

2. **DigitalOcean & Hugging Face**:

    - Deploy a Hugging Face model using DigitalOcean's 1-Click HUGS on a GPU Droplet .
    - Note the inference endpoint and authentication token provided upon deployment.

3. **Environment Variables**:

    Create a `.env` file in the `backend` directory and add the following:

    ```env
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_key
    HUGGINGFACE_ENDPOINT=your_huggingface_inference_endpoint
    HUGGINGFACE_TOKEN=your_huggingface_token
    ```

### Running the Application

1. **Start the backend server**:

    ```bash
    cd backend
    npm start
    ```

2. **Start the frontend development server**:

    ```bash
    cd ../frontend
    npm start
    ```

    The application should now be running at `http://localhost:3000`.

## Project Structure

```
IA-restful-AI-Project/
├── backend/           # Express.js server and API routes
├── frontend/          # React.js application
├── netlify.toml       # Netlify deployment configuration
└── _redirects         # Redirect rules for Netlify
```

## Deployment

-   **Frontend**: Deployed on Netlify using the `netlify.toml` and `_redirects` for configuration.
-   **Backend & AI Model**: Hosted on DigitalOcean's GPU Droplets with Hugging Face's HUGS for model deployment.

## License

This project is licensed under the [MIT License](LICENSE).
