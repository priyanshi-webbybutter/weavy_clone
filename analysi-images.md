<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Coordinate Tracker</title>
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
    </style>
</head>
<body class="bg-gray-50 min-h-screen flex flex-col items-center p-4 sm:p-8">


    <div class="max-w-4xl w-full bg-white shadow-xl rounded-xl p-6 sm:p-10">
        <h1 class="text-3xl font-extrabold text-blue-600 mb-6 text-center">
            Zoomable Coordinate Finder & AI Analyzer
        </h1>
        <p class="text-gray-600 mb-4 text-center">
            Upload an image, then:
            <ul class="list-disc list-inside mt-2 text-sm text-gray-500 inline-block text-left">
                <li>**Scroll** over the image to zoom in/out.</li>
                <li>**Drag** with the mouse button held down to pan (move) the image.</li>
                <li>**Click** to mark a point and retrieve coordinates and AI analysis.</li>
            </ul>
        </p>


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


        <!-- Display Area for Coordinates -->
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


            <!-- New AI Analysis Result Area -->
            <div class="bg-purple-50 p-4 rounded-lg border border-purple-200 md:col-span-2">
                <h2 class="text-xl font-semibold text-purple-700 mb-2">
                    AI Analysis Result (Object Name Only)
                </h2>
                <div id="analysis-loading" class="hidden flex items-center justify-center mt-2 py-4">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm text-purple-600">Analyzing image... (This may take a few seconds)</span>
                </div>
                <div id="ai-analysis-result" class="text-lg text-gray-800">
                    Click a point to start analysis...
                </div>
            </div>
        </div>
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
            const aiAnalysisResult = document.getElementById('ai-analysis-result');
            const analysisLoading = document.getElementById('analysis-loading');


            const messageBox = document.getElementById('messageBox');
            const messageText = document.getElementById('messageText');
            const closeMessage = document.getElementById('closeMessage');


            // --- Configuration and State ---
            const CANVAS_WIDTH = 600;
            const CANVAS_HEIGHT = 450;
            const INITIAL_TEXT = 'Upload an image above to start tracking coordinates.';
            const API_KEY = ""; // Placeholder for Gemini API Key
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;


            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;


            const img = new Image();
            img.crossOrigin = "Anonymous";
            let imageLoaded = false;
           
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
                        ctx.arc(markerX, markerY, 7 / scale, 0, Math.PI * 2);
                        ctx.fillStyle = 'red';
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 2 / scale;
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
                   
                    // Reset coordinates and analysis display
                    rawCoordsDisplay.textContent = 'N/A';
                    normalizedCoordsDisplay.textContent = 'N/A';
                    aiAnalysisResult.innerHTML = 'Click a point to start analysis...';
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


            /**
             * Calls the Gemini API to analyze the coordinates on the image.
             */
            const analyzeCoordinates = async (normalizedX, normalizedY) => {
                analysisLoading.classList.remove('hidden');
                aiAnalysisResult.textContent = '';


                try {
                    // 1. Get Base64 image data from the canvas
                    const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
                   
                    // 2. Construct the prompt to request ONLY the object name
                    const prompt = `Analyze this image. What is the single, most prominent object or feature located at the normalized coordinates [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}]? Normalized coordinates are 0.0 (top/left) to 1.0 (bottom/right). Return only the name of the object or feature, nothing else.`;


                    const payload = {
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: "image/jpeg",
                                        data: base64Data
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
                        aiAnalysisResult.textContent = candidate.content.parts[0].text.trim();
                    } else {
                        aiAnalysisResult.textContent = 'Analysis failed: Could not get a valid response from the AI.';
                        console.error("AI Response Error:", result);
                    }


                } catch (error) {
                    console.error('Gemini API Error:', error);
                    aiAnalysisResult.textContent = `Analysis Error: ${error.message}. Check the console for details.`;
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
                    aiAnalysisResult.textContent = 'Clicked outside the image bounds.';
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
                canvas.style.cursor = 'grabbing';
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


            canvas.addEventListener('mouseup', () => {
                isDragging = false;
                canvas.style.cursor = 'crosshair';
            });


            canvas.addEventListener('mouseleave', () => {
                isDragging = false;
                canvas.style.cursor = 'crosshair';
            });
        });
    </script>
</body>
</html>
