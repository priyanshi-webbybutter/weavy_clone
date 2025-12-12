<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Coordinate Tracker & Chat</title>
    <!-- Load Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Custom styles */
        .note {
            font-size: 0.9em;
            color: #6b7280; /* gray-500 */
        }
        #messageBox {
            transition: opacity 0.3s ease;
        }
        /* Style for grabbing cursor during pan */
        .cursor-grabbing {
            cursor: grabbing !important;
        }
        /* Style for the detailed results summary */
        details summary {
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            background-color: rgba(126, 34, 206, 0.1); /* purple-700/10 */
            color: #6d28d9; /* purple-700 */
            font-weight: 600;
        }
        details[open] summary {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }
        #chatOutput {
            height: 300px;
            overflow-y: auto;
            scroll-behavior: smooth;
        }
        /* Style for the Chip UI (Used in Analysis Panel and Chat Input) */
        .ai-chip { 
            display: inline-flex;
            align-items: center;
            padding: 6px 14px; 
            background-color: #6d28d9; /* purple-700 */
            color: white;
            border-radius: 9999px; 
            font-weight: 700;
            box-shadow: 0 2px 4px rgba(109, 40, 217, 0.2);
            transition: all 0.2s ease;
            cursor: pointer; /* Change to pointer for dropdown toggle */
            font-size: 0.875rem; /* text-sm */
            border: none;
        }
        /* Specific styling for the chip in the analysis panel */
        #ai-analysis-container .ai-chip {
            padding: 8px 16px;
            font-size: 1rem;
            cursor: default;
        }
        .chip-icon {
            width: 18px; 
            height: 18px;
            margin-right: 6px;
        }
        
        /* Styling for the chat input container to handle the chip */
        #chatInputContainer {
            display: flex;
            align-items: center;
            position: relative; 
            padding: 4px; 
            background-color: white;
            border: 1px solid #d1d5db; /* gray-300 */
            border-radius: 0.5rem; /* rounded-lg */
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        #chatInputContainer:focus-within {
            border-color: #4f46e5; /* indigo-500 */
            box-shadow: 0 0 0 1px #4f46e5; /* focus ring */
        }
        
        /* The chip container inside the chat input */
        #chatChipPlaceholder {
            display: flex;
            align-items: center;
            padding-left: 4px;
        }
        
        /* The actual text input element */
        #chatInput {
            flex-grow: 1;
            border: none;
            padding: 8px 12px;
            outline: none; 
            background: transparent;
            min-width: 50px; 
        }
        #chatInput.no-chip-padding {
            padding: 12px; 
        }
        
        /* Dropdown menu positioning */
        #chipDropdownMenu {
            position: absolute; 
            z-index: 50;
            top: 100%; 
            margin-top: 4px;
            width: 256px; 
        }
        .rotate-180 {
            transform: rotate(180deg);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen flex flex-col items-center p-4 sm:p-8">

    <div class="max-w-4xl w-full bg-white shadow-xl rounded-xl p-6 sm:p-10">
        <h1 class="text-3xl font-extrabold text-blue-600 mb-6 text-center">
            Zoomable Coordinate Finder & AI Analyzer
        </h1>
        <div class="text-gray-600 mb-4 text-center">
            Upload an image, then:
            <ul class="list-disc list-inside mt-2 text-sm text-gray-500 inline-block text-left">
                <li>**Scroll** over the image to zoom in/out.</li>
                <li>**Click** to mark a point and trigger structured AI analysis.</li>
            </ul>
        </div>

        <!-- Image Upload Input -->
        <div class="mb-6 flex justify-center">
            <input type="file" id="imageUpload" accept="image/*" class="file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 cursor-pointer"
            >
        </div>

        <!-- The Canvas element -->
        <div class="flex justify-center">
            <canvas id="imageCanvas" width="600" height="450" 
                    class="border-4 border-blue-400 rounded-lg shadow-inner cursor-crosshair"></canvas>
        </div>

        <!-- Display Area for Coordinates & Analysis -->
        <div id="coordinate-info" class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h2 class="text-xl font-semibold text-blue-700 mb-2">
                    Raw Pixel Coordinates (X, Y)
                </h2>
                <p class="text-2xl font-mono text-gray-800 break-words">
                    <span id="raw-coords" class="font-bold">N/A</span>
                </p>
                <p class="note mt-1">Raw position on the 600x450 canvas screen.</p>
            </div>

            <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                <h2 class="text-xl font-semibold text-green-700 mb-2">
                    Normalized Coordinates (0.0 - 1.0)
                </h2>
                <p class="text-2xl font-mono text-gray-800 break-words">
                    <span id="normalized-coords" class="font-bold">N/A</span>
                </p>
                <p class="note mt-1">Universal fraction of the original image. Accurate regardless of zoom/pan.</p>
            </div>

            <!-- Feature 1: AI Object Name Analysis -->
            <div class="bg-purple-50 p-4 rounded-lg border border-purple-200 md:col-span-2">
                <h2 class="text-xl font-semibold text-purple-700 mb-2">
                    AI Object Identification & Details (Structured)
                </h2>
                <div id="analysis-loading" class="hidden flex items-center justify-center mt-2 py-4">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm text-purple-600">Performing structured analysis...</span>
                </div>
                
                <!-- Display area for the main analysis chip -->
                <div id="ai-analysis-container" class="min-h-[50px]">
                    <span id="ai-analysis-main" class="text-lg font-bold text-gray-800 mb-3">
                        Click a point to start identification...
                    </span>
                </div>
                <!-- End Updated display area -->

                <div id="ai-analysis-details" class="mt-2 text-sm">
                    <!-- Detailed suggestions will be injected here -->
                </div>
            </div>

            <!-- Feature 2: ✨ Creative Description Generator (Gemini Feature) -->
            <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200 md:col-span-2 mt-4">
                <h2 class="text-xl font-semibold text-yellow-700 mb-2">
                    ✨ Creative Description Generator
                </h2>
                <button id="generateDescriptionBtn" class="bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition duration-150 font-bold w-full disabled:opacity-50" disabled>
                    ✨ Describe the Marked Object
                </button>
                <div id="description-loading" class="hidden flex items-center justify-center mt-2 py-2">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm text-yellow-600">Generating description...</span>
                </div>
                <div id="creative-description-result" class="text-lg text-gray-800 mt-2">
                    A description will appear here after identification and button click.
                </div>
            </div>
        </div>

        <!-- NEW: Chat Interface -->
        <div class="mt-8 bg-gray-100 p-6 rounded-xl border border-gray-300">
            <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 mr-2 text-indigo-600"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Image Companion Chat
            </h2>
            <div id="chatOutput" class="bg-white p-4 rounded-lg mb-4 shadow-inner border border-gray-200">
                <div class="mb-2 p-2 bg-indigo-50 text-indigo-800 rounded-lg">
                    <span class="font-semibold">AI Assistant:</span> Hello! Upload an image to enable chat. You can ask general questions about the image once it's loaded.
                </div>
            </div>
            
            <div class="flex space-x-3">
                <!-- NEW: Chip container around the input field -->
                <div id="chatInputContainer" class="flex-1">
                    <div id="chatChipPlaceholder" class="relative hidden">
                        <!-- Dropdown chip structure will be injected here -->
                    </div>
                    <input type="text" id="chatInput" placeholder="Ask a question about the image..." 
                           class="no-chip-padding disabled:bg-white disabled:cursor-text" disabled>
                </div>
                <!-- END NEW -->
                
                <button id="chatSendBtn" class="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition duration-150 font-semibold disabled:opacity-50" disabled>
                    Send
                </button>
            </div>
        </div>
        <!-- END: Chat Interface -->
    </div>

    <!-- Custom Message Box UI (Replacing alert()) -->
    <div id="messageBox" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center p-4 z-50">
        <div class="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full transform transition-all">
            <p id="messageText" class="text-lg text-red-600 font-semibold mb-4 text-center"></p>
            <button id="closeMessage" class="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition duration-150">
                OK
            </button>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('imageCanvas');
            const ctx = canvas.getContext('2d');
            const rawCoordsDisplay = document.getElementById('raw-coords');
            const normalizedCoordsDisplay = document.getElementById('normalized-coords');
            const imageUpload = document.getElementById('imageUpload');
            
            // Feature 1 Elements
            const aiAnalysisContainer = document.getElementById('ai-analysis-container'); 
            const aiAnalysisDetails = document.getElementById('ai-analysis-details');
            const analysisLoading = document.getElementById('analysis-loading');

            // Feature 2 Elements
            const generateDescriptionBtn = document.getElementById('generateDescriptionBtn');
            const creativeDescriptionResult = document.getElementById('creative-description-result');
            const descriptionLoading = document.getElementById('description-loading');

            // Feature 3 (Chat) Elements
            const chatOutput = document.getElementById('chatOutput');
            const chatChipPlaceholder = document.getElementById('chatChipPlaceholder'); // Placeholder for the chip/dropdown
            const chatInput = document.getElementById('chatInput');
            const chatSendBtn = document.getElementById('chatSendBtn');

            const messageBox = document.getElementById('messageBox');
            const messageText = document.getElementById('messageText');
            const closeMessage = document.getElementById('closeMessage');

            // --- Configuration and State ---
            const CANVAS_WIDTH = 600;
            const CANVAS_HEIGHT = 450;
            const INITIAL_TEXT = 'Upload an image above to start tracking coordinates.';
            const API_KEY = ""; // Placeholder for Gemini API Key
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
            
            // Shared State
            let chatHistory = [];
            let currentBase64Image = null; 
            let isChatting = false;
            let imageLoaded = false;
            
            // New State for Detections
            let lastDetections = []; 
            let selectedDetection = null; 

            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;

            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            // Image Transformation State
            let scale = 1.0;
            let posX = 0; 
            let posY = 0; 
            let baseWidth = 0; 
            let baseHeight = 0; 
            
            // Pan State
            let isDragging = false;
            let lastMouseX = 0;
            let lastMouseY = 0;

            // Marker State (Normalized position of the last click)
            let markerNormX = null; 
            let markerNormY = null; 

            // --- Utility Functions ---

            const showMessage = (message) => {
                messageText.textContent = message;
                messageBox.classList.remove('hidden');
                messageBox.classList.add('flex');
            };

            closeMessage.addEventListener('click', () => {
                messageBox.classList.add('hidden');
                messageBox.classList.remove('flex');
            });
            
            const calculateInitialImageState = () => {
                const hRatio = CANVAS_WIDTH / img.width;
                const vRatio = CANVAS_HEIGHT / img.height;
                const initialRatio = Math.min(hRatio, vRatio);
                
                baseWidth = img.width * initialRatio;
                baseHeight = img.height * initialRatio;

                posX = (CANVAS_WIDTH - baseWidth) / 2;
                posY = (CANVAS_HEIGHT - baseHeight) / 2;

                scale = 1.0; 
                markerNormX = null; 
            };

            const drawImage = () => {
                ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                
                if (imageLoaded && img.complete) {
                    const currentDrawWidth = baseWidth * scale;
                    const currentDrawHeight = baseHeight * scale;

                    ctx.drawImage(img, 
                        0, 0, 
                        img.width, img.height, 
                        posX, posY, 
                        currentDrawWidth, currentDrawHeight 
                    );

                    if (markerNormX !== null) {
                        const markerX = posX + (markerNormX * baseWidth * scale);
                        const markerY = posY + (markerNormY * baseHeight * scale);

                        ctx.beginPath();
                        // Adjust marker size based on scale
                        const markerRadius = 7 / scale;
                        const markerLineWidth = 2 / scale;

                        ctx.arc(markerX, markerY, markerRadius, 0, Math.PI * 2); 
                        ctx.fillStyle = 'red';
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = markerLineWidth;
                        ctx.fill();
                        ctx.stroke();
                        ctx.closePath();
                    }
                } else {
                    ctx.font = '20px Inter, sans-serif';
                    ctx.fillStyle = '#6b7280';
                    ctx.textAlign = 'center';
                    ctx.fillText(INITIAL_TEXT, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
                }
            };

            // Initial drawing of the instruction text
            drawImage(); 

            // Handle image loading
            img.onload = () => {
                imageLoaded = true;
                calculateInitialImageState();
                drawImage();

                // Store base64 data and enable chat
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.naturalWidth;
                tempCanvas.height = img.naturalHeight;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0);
                // Use image/jpeg for smaller payload size
                currentBase64Image = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]; 

                chatInput.disabled = false;
                chatSendBtn.disabled = false;
                chatOutput.innerHTML = `<div class="mb-2 p-2 bg-indigo-50 text-indigo-800 rounded-lg">
                    <span class="font-semibold">AI Assistant:</span> Image loaded! Ask me anything about this picture.
                </div>`;
            };
            img.onerror = () => {
                imageLoaded = false;
                showMessage('Error loading image. Please try another file.');
                drawImage();
            };

            // --- Image Upload Handler ---
            imageUpload.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result; 
                    
                    // Reset analysis display
                    rawCoordsDisplay.textContent = 'N/A';
                    normalizedCoordsDisplay.textContent = 'N/A';
                    resetAnalysisUI('Click a point to start identification...');
                    
                    aiAnalysisDetails.innerHTML = '';
                    creativeDescriptionResult.textContent = 'A description will appear here after identification and button click.';
                    generateDescriptionBtn.disabled = true;
                    selectedDetection = null;
                    lastDetections = [];
                    
                    // Reset chat history and UI
                    chatHistory = [];
                    chatInput.disabled = true;
                    chatSendBtn.disabled = true;
                    currentBase64Image = null;
                    chatInput.value = ''; 
                    chatInput.classList.add('no-chip-padding'); 
                    chatChipPlaceholder.classList.add('hidden'); 
                };
                reader.readAsDataURL(file);
            });
            
            /**
             * Performs exponential backoff retry logic for the API call.
             */
            const fetchWithRetry = async (url, options, maxRetries = 5) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const response = await fetch(url, options);
                        if (response.status === 429 && i < maxRetries - 1) {
                            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                        if (!response.ok) {
                            const errorBody = await response.text();
                            throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorBody}`);
                        }
                        return response.json();
                    } catch (error) {
                        if (i === maxRetries - 1) throw error;
                    }
                }
            };

            // --- Chat Feature Logic (Feature 3) ---

            /**
             * Appends a message to the chat output display.
             */
            const appendMessage = (role, text) => {
                const messageDiv = document.createElement('div');
                const isUser = role === 'user';
                
                messageDiv.className = `mb-3 p-3 rounded-lg max-w-[85%] ${
                    isUser 
                        ? 'ml-auto bg-blue-500 text-white shadow-md' 
                        : 'mr-auto bg-gray-200 text-gray-800 shadow-sm'
                }`;

                const roleSpan = document.createElement('span');
                roleSpan.className = 'font-bold mr-1';
                roleSpan.textContent = isUser ? 'You:' : 'AI Assistant:';
                
                if (isUser) {
                    messageDiv.innerHTML = text; 
                } else {
                    messageDiv.appendChild(roleSpan);
                    messageDiv.appendChild(document.createTextNode(text));
                }

                chatOutput.appendChild(messageDiv);
                chatOutput.scrollTop = chatOutput.scrollHeight;
            };

            /**
             * Handles sending a message to the Gemini API and updating the chat history.
             */
            const sendMessage = async () => {
                const userQuery = chatInput.value.trim();
                if (!userQuery || !currentBase64Image || isChatting) return;

                isChatting = true;
                
                const queryText = userQuery; 
                chatInput.value = ''; 
                
                chatInput.disabled = true;
                chatSendBtn.disabled = true;
                
                // Clear and hide the chip/dropdown after use
                chatChipPlaceholder.innerHTML = '';
                chatChipPlaceholder.classList.add('hidden');
                chatInput.classList.add('no-chip-padding'); 

                appendMessage('user', queryText);
                
                // Add user message to history
                chatHistory.push({ 
                    role: "user", 
                    parts: [{ text: queryText }] 
                });

                // Create a temporary loading message
                const loadingMessageId = `loading-${Date.now()}`;
                const loadingDiv = document.createElement('div');
                loadingDiv.id = loadingMessageId;
                loadingDiv.className = 'mb-3 p-3 rounded-lg max-w-[85%] mr-auto bg-gray-200 text-gray-800 shadow-sm flex items-center';
                loadingDiv.innerHTML = `
                    <span class="font-bold mr-1">AI Assistant:</span> 
                    <svg class="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="ml-2 text-sm">Thinking...</span>
                `;
                chatOutput.appendChild(loadingDiv);
                chatOutput.scrollTop = chatOutput.scrollHeight;

                try {
                    // Add the image to the most recent user turn for visual context
                    const contentsToSend = JSON.parse(JSON.stringify(chatHistory)); // Deep copy 
                    const lastUserTurn = contentsToSend[contentsToSend.length - 1];
                    lastUserTurn.parts.push({
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: currentBase64Image
                        }
                    });

                    const payload = {
                        contents: contentsToSend,
                        systemInstruction: {
                            parts: [{ text: "You are a helpful, witty assistant specializing in analyzing the uploaded image. Keep your answers concise and directly related to the picture when possible." }]
                        }
                    };
                    
                    const result = await fetchWithRetry(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const candidate = result.candidates?.[0];
                    let aiResponseText = 'Sorry, I encountered an issue generating a response.';

                    if (candidate && candidate.content?.parts?.[0]?.text) {
                        aiResponseText = candidate.content.parts[0].text.trim();
                        
                        // Add AI response to history
                        chatHistory.push({
                            role: "model",
                            parts: [{ text: aiResponseText }]
                        });
                    }

                    document.getElementById(loadingMessageId).remove();
                    appendMessage('model', aiResponseText);

                } catch (error) {
                    console.error('Gemini Chat API Error:', error);
                    document.getElementById(loadingMessageId).remove();
                    appendMessage('model', `Chat Error: Failed to connect to AI. (${error.message})`);
                } finally {
                    isChatting = false;
                    chatInput.disabled = false;
                    chatSendBtn.disabled = false;
                    chatInput.focus(); 
                }
            };
            
            // Event listeners for chat
            chatSendBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });

            // --- Dropdown Chip Logic ---

            /**
             * Updates the state and chat input when a new detection is selected from the dropdown.
             */
            const selectDetection = (detection) => {
                if (!detection) return;
                selectedDetection = detection;
                const capitalizedLabel = detection.label.charAt(0).toUpperCase() + detection.label.slice(1);

                // Update the chip display
                const chipToggle = document.getElementById('chipDropdownToggle');
                if (chipToggle) {
                    chipToggle.querySelector('span').textContent = capitalizedLabel;
                }
                
                // Update the chat input prompt
                // Pre-fills the input with a query about the selected object
                chatInput.value = `Tell me more about the identified object: ${capitalizedLabel}.`;
                
                // Hide the dropdown menu
                const dropdownMenu = document.getElementById('chipDropdownMenu');
                if (dropdownMenu) {
                    dropdownMenu.classList.add('hidden');
                    document.getElementById('chipChevron').classList.remove('rotate-180');
                }
                chatInput.focus();
            }

            /**
             * Generates the SVG and HTML structure for the AI chip and dropdown menu.
             * This is the function that injects the AI output (detections) into the chat input.
             */
            const renderObjectChip = (detections, isFallback = false) => {
                if (!detections || detections.length === 0) return;

                // Set primary selection based on priority/first item
                selectedDetection = detections[0];
                const primaryLabel = selectedDetection.label.charAt(0).toUpperCase() + selectedDetection.label.slice(1);
                
                const color = isFallback ? '#f59e0b' : '#6d28d9'; // purple or amber
                const iconSvg = isFallback 
                    ? `<line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>`
                    : `<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle>`; // target icon

                // 1. Generate Dropdown Menu Items
                const dropdownItems = detections.map((det, index) => {
                    const label = det.label.charAt(0).toUpperCase() + det.label.slice(1);
                    return `
                        <li data-index="${index}" class="p-2 text-sm cursor-pointer hover:bg-indigo-100 transition duration-100 rounded-md mx-1 my-[1px] ${index === 0 ? 'font-semibold bg-purple-50' : ''}">
                            ${label} <span class="text-xs text-gray-500">(${det.kind})</span>
                        </li>
                    `;
                }).join('');

                // 2. Generate Full Dropdown Chip HTML
                const chipHtml = `
                    <button id="chipDropdownToggle" class="ai-chip focus:outline-none" style="background-color: ${color};">
                        <svg xmlns="http://www.w3.org/2000/svg" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${iconSvg}
                        </svg>
                        <span>${primaryLabel}</span>
                        <svg id="chipChevron" class="w-4 h-4 ml-2 transition-transform duration-200" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <ul id="chipDropdownMenu" class="absolute z-50 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl hidden py-1">
                        ${dropdownItems}
                    </ul>
                `;

                // 3. Update Analysis Panel (static chip)
                const analysisChipHtml = generateChipHtml(primaryLabel, color, iconSvg).replace('cursor: pointer;', 'cursor: default;');
                aiAnalysisContainer.innerHTML = analysisChipHtml;
                
                // 4. Update Chat Input (dropdown chip)
                // This is where the chip and dropdown are injected into the input container
                chatChipPlaceholder.innerHTML = chipHtml;
                chatChipPlaceholder.classList.remove('hidden');
                chatInput.classList.remove('no-chip-padding'); 
                
                // 5. Initialize the dropdown logic
                const dropdownToggle = document.getElementById('chipDropdownToggle');
                const dropdownMenu = document.getElementById('chipDropdownMenu');
                const chipChevron = document.getElementById('chipChevron');

                // Toggle logic
                dropdownToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('hidden');
                    chipChevron.classList.toggle('rotate-180');
                });

                // Selection logic
                dropdownMenu.querySelectorAll('li').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const index = parseInt(item.getAttribute('data-index'));
                        selectDetection(lastDetections[index]);
                    });
                });

                // Hide dropdown when clicking anywhere else
                document.addEventListener('click', (e) => {
                    if (!chatChipPlaceholder.contains(e.target)) {
                        dropdownMenu.classList.add('hidden');
                        chipChevron.classList.remove('rotate-180');
                    }
                });

                // 6. Update Text Input Content
                selectDetection(selectedDetection); // Initialize the chat input text
            };

            const generateChipHtml = (objectName, backgroundColor, iconSvg) => {
                 return `
                    <div class="ai-chip" style="background-color: ${backgroundColor};">
                        <svg xmlns="http://www.w3.org/2000/svg" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${iconSvg}
                        </svg>
                        <span>${objectName}</span>
                    </div>
                `;
            };

            /**
             * Resets the analysis UI section.
             */
            const resetAnalysisUI = (initialText) => {
                aiAnalysisContainer.innerHTML = `
                    <span id="ai-analysis-main" class="text-lg font-bold text-gray-800 mb-3">
                        ${initialText}
                    </span>
                `;
                aiAnalysisDetails.innerHTML = '';
                
                // Also reset the chat chip
                lastDetections = [];
                selectedDetection = null;
                chatChipPlaceholder.innerHTML = '';
                chatChipPlaceholder.classList.add('hidden');
                chatInput.classList.add('no-chip-padding'); 
            };


            /**
             * Renders the detailed analysis results.
             * This function calls renderObjectChip which places the chip in the chat input.
             */
            const renderSuggestions = (suggestions) => {
                if (!suggestions || suggestions.length === 0) {
                    resetAnalysisUI('No specific objects detected near this point.');
                    return;
                }

                // Store all valid suggestions
                suggestions.sort((a, b) => a.priority_index - b.priority_index);
                lastDetections = suggestions;
                
                // Render the chip/dropdown in both locations
                // This call updates the chat input with the chip UI
                renderObjectChip(lastDetections, false);

                // Render the Detailed Detections list
                const listItems = suggestions.map(s => {
                    const bbox = s.bbox || { x: NaN, y: NaN, width: NaN, height: NaN }; 
                    const priorityText = s.priority_index <= 6 ? ' (High Priority)' : ' (Low Priority)';
                    const bboxText = `BBox: x:${bbox.x ? bbox.x.toFixed(4) : 'N/A'}, y:${bbox.y ? bbox.y.toFixed(4) : 'N/A'}, w:${bbox.width ? bbox.width.toFixed(4) : 'N/A'}, h:${bbox.height ? bbox.height.toFixed(4) : 'N/A'}`;
                    
                    return `
                        <li class="p-2 border-l-4 border-purple-500 bg-purple-100 rounded-md">
                            <span class="font-semibold text-purple-800">${s.label.toUpperCase()}</span> 
                            <span class="text-xs text-gray-600">(${s.kind || 'Detection'})${priorityText}</span><br>
                            <span class="font-mono text-xs text-gray-500">${bboxText}</span>
                        </li>
                    `;
                }).join('');

                aiAnalysisDetails.innerHTML = `
                    <details open>
                        <summary>Detailed Detections (${suggestions.length})</summary>
                        <ul class="mt-2 space-y-2 p-3 bg-white border border-purple-200 rounded-b-lg">
                            ${listItems}
                        </ul>
                    </details>
                `;
            };
            

            /**
             * Feature 2: Generates a creative description based on the identified object and image.
             */
            const generateCreativeDescription = async () => {
                const objectName = selectedDetection?.label.charAt(0).toUpperCase() + selectedDetection?.label.slice(1);

                if (!imageLoaded || !objectName || objectName === 'General Area') {
                    showMessage('Please identify a specific object first by clicking a point on the image.');
                    return;
                }

                descriptionLoading.classList.remove('hidden');
                creativeDescriptionResult.textContent = 'Waiting for AI inspiration...';
                generateDescriptionBtn.disabled = true;

                try {
                    const prompt = `Based on the identified object "${objectName}", write a single, short, highly creative and evocative sentence (like a poetic caption) about this element in the context of the image provided. Do not use quotes or introductory phrases.`;

                    const payload = {
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: "image/jpeg",
                                        data: currentBase64Image // Use stored base64
                                    }
                                }
                            ]
                        }],
                    };
                    
                    const result = await fetchWithRetry(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const candidate = result.candidates?.[0];
                    if (candidate && candidate.content?.parts?.[0]?.text) {
                        creativeDescriptionResult.textContent = candidate.content.parts[0].text.trim();
                    } else {
                        creativeDescriptionResult.textContent = 'Description failed: Could not get a valid response from the AI.';
                    }

                } catch (error) {
                    console.error('Gemini API Error for description:', error);
                    creativeDescriptionResult.textContent = `Description Error: ${error.message}. Check the console for details.`;
                } finally {
                    descriptionLoading.classList.add('hidden');
                    generateDescriptionBtn.disabled = false;
                }
            };

            generateDescriptionBtn.addEventListener('click', generateCreativeDescription);

            /**
             * Checks if a normalized point is inside a normalized bounding box.
             */
            const isPointInsideBBox = (pointX, pointY, bbox) => {
                if (!bbox || typeof bbox.x !== 'number' || typeof bbox.y !== 'number' || typeof bbox.width !== 'number' || typeof bbox.height !== 'number') {
                    return false; // Invalid BBox
                }
                const TOLERANCE = 0.02; 

                const isInside = (
                    pointX >= bbox.x - TOLERANCE &&
                    pointX <= bbox.x + bbox.width + TOLERANCE &&
                    pointY >= bbox.y - TOLERANCE &&
                    pointY <= bbox.y + bbox.height + TOLERANCE
                );
                return isInside;
            };

            /**
             * Feature 1: Calls the Gemini API to identify the object at the coordinates using structured output.
             */
            const analyzeCoordinates = async (normalizedX, normalizedY) => {
                analysisLoading.classList.remove('hidden');
                resetAnalysisUI('Performing structured analysis...');
                generateDescriptionBtn.disabled = true;
                creativeDescriptionResult.textContent = 'A description will appear here after identification and button click.';
                chatInput.value = ''; 

                try {
                    if (!currentBase64Image) {
                        throw new Error("Image data is not yet available for analysis.");
                    }
                    
                    const prompt = `You are a detection and priority AI. Analyze the image and return a JSON array containing ALL detected objects and their normalized bounding boxes (bbox). The click point is at normalized coordinates: [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}].
                    
                    For each object, include:
                    1. label: (e.g., 'sunglasses', 'hat', 'face')
                    2. kind: (e.g., 'object', 'person', 'text')
                    3. priority_index: Use a low number (1-6) for high priority items (Glasses, Hats, Bottles, Hands, Faces, Text). Use 999 for everything else.
                    
                    Normalized coordinates range from 0.0 to 1.0 (top-left to bottom-right). Return ONLY the JSON array.`;

                    // JSON schema
                    const responseSchema = {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "label": { "type": "STRING" },
                                "kind": { "type": "STRING" },
                                "priority_index": { "type": "INTEGER" },
                                "bbox": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "x": { "type": "NUMBER" },
                                        "y": { "type": "NUMBER" },
                                        "width": { "type": "NUMBER" },
                                        "height": { "type": "NUMBER" }
                                    },
                                    "required": ["x", "y", "width", "height"]
                                }
                            },
                            "required": ["label", "kind", "priority_index", "bbox"]
                        }
                    };

                    const payload = {
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: "image/jpeg",
                                        data: currentBase64Image
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: responseSchema
                        }
                    };
                    
                    const result = await fetchWithRetry(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const candidate = result.candidates?.[0];
                    if (candidate && candidate.content?.parts?.[0]?.text) {
                        const jsonText = candidate.content.parts[0].text.trim();
                        let suggestions = [];
                        
                        try {
                            suggestions = JSON.parse(jsonText);
                            if (!Array.isArray(suggestions)) {
                                throw new Error("Parsed JSON is not an array.");
                            }
                        } catch (parseError) {
                            console.error('JSON Parsing Error:', parseError, 'Raw text:', jsonText.substring(0, 100));
                            resetAnalysisUI('Analysis failed: AI returned invalid JSON structure.');
                            aiAnalysisDetails.innerHTML = `<p class="text-xs text-red-500">Could not parse JSON. Received: ${jsonText.substring(0, 100)}...</p>`;
                            return; 
                        }

                        // --- Validation and Filtering Logic ---
                        const validSuggestions = suggestions.filter(s => {
                            if (!s.bbox) return false;
                            return isPointInsideBBox(normalizedX, normalizedY, s.bbox);
                        });
                        
                        // 2. Process and Render
                        if (validSuggestions.length > 0) {
                            renderSuggestions(validSuggestions); // <--- This function calls renderObjectChip
                            generateDescriptionBtn.disabled = false;
                        } else {
                            // FALLBACK: Simple detection if no bbox matches
                            const fallbackPrompt = `The structured detection failed to find an object bounding box at the point [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}]. What is the general feature or area the click point is on? Return ONLY the name (e.g., 'blue sky', 'pavement', 'wooden desk').`;

                            const simpleResult = await fetchWithRetry(API_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ contents: [{ parts: [{ text: fallbackPrompt }, { inlineData: { mimeType: "image/jpeg", data: currentBase64Image } }] }] })
                            });

                            const simpleName = simpleResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'General Area';
                            
                            // Render Fallback as a chip
                            const fallbackDetection = { label: simpleName, kind: 'General Area', priority_index: 999 };
                            lastDetections = [fallbackDetection];
                            renderObjectChip(lastDetections, true);

                            aiAnalysisDetails.innerHTML = `<p class="text-gray-500 mt-2">No specific object bounding box found. Displaying general area result.</p>`;
                            generateDescriptionBtn.disabled = false;
                        }

                    } else {
                        resetAnalysisUI('Structured analysis failed: Empty AI response.');
                    }

                } catch (error) {
                    console.error('Gemini API Fatal Error:', error);
                    resetAnalysisUI(`Analysis Error: ${error.message}.`);
                } finally {
                    analysisLoading.classList.add('hidden');
                }
            };

            // --- Event Listeners for Interaction (Zoom/Pan/Click) ---

            const canvasToNormalized = (Cx, Cy) => {
                const I_scaled_x = Cx - posX;
                const I_scaled_y = Cy - posY;

                const I_orig_x = I_scaled_x / scale;
                const I_orig_y = I_scaled_y / scale;

                const Nx = I_orig_x / baseWidth;
                const Ny = I_orig_y / baseHeight;
                
                return { Nx, Ny };
            };

            // Handle Click (Marking Coordinates)
            canvas.addEventListener('click', function(event) {
                if (!imageLoaded) {
                    showMessage('Please upload an image first to start marking coordinates.');
                    return;
                }
                
                const rect = canvas.getBoundingClientRect();
                const rawX = event.clientX - rect.left;
                const rawY = event.clientY - rect.top;

                const { Nx, Ny } = canvasToNormalized(rawX, rawY);
                
                // Only mark and analyze if the click is within the image bounds (0 to 1)
                if (Nx >= 0 && Nx <= 1 && Ny >= 0 && Ny <= 1) {
                    markerNormX = Nx;
                    markerNormY = Ny;
                    
                    // 1. Update display
                    rawCoordsDisplay.textContent = `[${Math.round(rawX)}, ${Math.round(rawY)}]`;
                    normalizedCoordsDisplay.textContent = 
                        `[${Nx.toFixed(4)}, ${Ny.toFixed(4)}]`;

                    // 2. Redraw marker
                    drawImage(); 
                    
                    // 3. Start AI Analysis
                    analyzeCoordinates(Nx, Ny);

                } else {
                    rawCoordsDisplay.textContent = 'N/A';
                    normalizedCoordsDisplay.textContent = 'N/A';
                    resetAnalysisUI('Clicked outside the image bounds.');
                    creativeDescriptionResult.textContent = 'A description will appear here after identification and button click.';
                    generateDescriptionBtn.disabled = true;

                    markerNormX = null;
                    markerNormY = null;
                    drawImage();
                }
            });

            // Handle Zoom (Mouse Wheel)
            canvas.addEventListener('wheel', (event) => {
                if (!imageLoaded) return;
                event.preventDefault(); 

                const rect = canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;
                
                const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
                const newScale = scale * zoomFactor;

                if (newScale < 0.5) return; 

                const { Nx, Ny } = canvasToNormalized(mouseX, mouseY);
                const I_orig_x = Nx * baseWidth;
                const I_orig_y = Ny * baseHeight;
                
                posX = mouseX - (I_orig_x * newScale);
                posY = mouseY - (I_orig_y * newScale);
                scale = newScale;

                drawImage();
            });

            // Handle Pan (Mouse Drag)
            canvas.addEventListener('mousedown', (event) => {
                if (!imageLoaded) return;
                if (event.button !== 0) return; 

                isDragging = true;
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
                canvas.classList.add('cursor-grabbing');
            });

            canvas.addEventListener('mousemove', (event) => {
                if (!isDragging || !imageLoaded) return;

                const dx = event.clientX - lastMouseX;
                const dy = event.clientY - lastMouseY;

                posX += dx;
                posY += dy;

                lastMouseX = event.clientX;
                lastMouseY = event.clientY;

                drawImage();
            });

            const stopDragging = () => {
                isDragging = false;
                canvas.classList.remove('cursor-grabbing');
            };

            window.addEventListener('mouseup', stopDragging);
            canvas.addEventListener('mouseleave', stopDragging);
        });
    </script>
</body>
</html>