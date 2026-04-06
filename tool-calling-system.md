🎯 Minimal Tool-Calling System: Shapes & Images
Let's create a simple system with 3 main tools:
Shape Generator (for geometric shapes)
Image Generator (for full images)
Image Analyzer (for analyzing existing images)

1️⃣ INPUT PARSER
def parse_user_input(query):
    # Simple regex-based parser for a minimalist system
    import re
    
    # Extract action
    action = "generate" if "generate" in query or "create" in query else "suggest"
    
    # Extract subject
    if "shape" in query or "geometric" in query:
        subject = "shape"
    elif "image" in query or "photo" in query:
        subject = "image"
    else:
        subject = "unknown"
    
    # Extract parameters
    size_match = re.search(r"size:\s*(\d+)", query)
    color_match = re.search(r"color:\s*([a-zA-Z]+)", query)
    shape_type = re.search(r"(circle|square|triangle|rectangle)", query)
    
    return {
        "action": action,
        "subject": subject,
        "shape": shape_type.group(1) if shape_type else None,
        "color": color_match.group(1) if color_match else "blue",
        "size": int(size_match.group(1)) if size_match else 512
    }


2️⃣ TASK ROUTER
def route_task(parsed):
    if parsed["subject"] == "shape":
        return "shape_generator"
    elif parsed["subject"] == "image":
        return "image_generator"
    else:
        return "suggestion"


3️⃣ TOOL EXECUTOR (Mock Implementation)
def execute_task(route, parsed):
    if route == "shape_generator":
        # Simple mock - returns a description
        return f"Generated {parsed['shape']} in {parsed['color']} color, size {parsed['size']}x{parsed['size']}"
    
    elif route == "image_generator":
        # Mock - returns a base64 string simulating an image
        return "base64_encoded_image_string"
    
    elif route == "suggestion":
        # Simple suggestion logic
        if "blue" in parsed["color"]:
            return "I recommend using bright blue for maximum visibility. Would you like me to generate it?"
        else:
            return f"Based on your request, I suggest creating a {parsed['color']} {parsed['shape']} at {parsed['size']} pixels. Would you like me to proceed?"


4️⃣ OUTPUT FORMATTER
def format_response(result, route):
    if route == "shape_generator":
        return f"![Generated Shape](data:image/png;base64,{result})\n\nI've created your geometric shape: a {parsed['shape']} in {parsed['color']} at {parsed['size']}x{parsed['size']} pixels. Would you like to modify the color or size?"
    
    elif route == "image_generator":
        return f"![Generated Image](data:image/png;base64,{result})\n\nI've created your image. Would you like any adjustments to the colors or composition?"


📊 Complete Flow Example
User Input: "Generate a red circle, size 200 pixels"
Step 1: Parse Input
{
  "action": "generate",
  "subject": "shape",
  "shape": "circle",
  "color": "red",
  "size": 200
}

Step 2: Route Task
Route: shape_generator

Step 3: Execute
Execute shape_generator with parameters
Result: "base64_encoded_image_of_red_circle_200x200"

Step 4: Format Output
![Generated Shape](data:image/png;base64,base64_encoded_image_of_red_circle_200x200)

I've created your geometric shape: a circle in red at 200x200 pixels. Would you like to modify the color or size?


🎨 How This Applies to Your Project
Your Tools (Shapes & Images)
Tool 1: Shape Generator
Function: generate_shape(shape, color, size)
Purpose: Creates simple geometric shapes (circle, square, triangle, rectangle)
Output: Base64 image string
Tool 2: Image Generator
Function: generate_image(prompt)
Purpose: Creates full images based on text descriptions
Output: Base64 image string
Tool 3: Image Analyzer
Function: analyze_image(image_url)
Purpose: Analyzes existing images for features
Output: JSON description

Your System Structure
User Input
   ↓
[Parse Input] → Extract shape, color, size
   ↓
[Route Task] → shape_generator OR image_generator OR suggestion
   ↓
[Execute] → Call appropriate tool
   ↓
[Format Output] → Display image or suggestion


📋 Example: Full Implementation in Code
Here's how you could implement this in Python:
import re
import base64
from PIL import Image, ImageDraw

# === IMAGE GENERATION TOOL ===
def generate_image(prompt, size=512):
    # Simple mock - creates a solid colored image
    im = Image.new('RGB', (size, size), color=prompt)
    return base64.b64encode(im.tobytes()).decode('utf-8')

# === SHAPE GENERATOR TOOL ===
def generate_shape(shape, color, size):
    im = Image.new('RGB', (size, size), (255, 255, 255))  # White background
    draw = ImageDraw.Draw(im)
    
    if shape == "circle":
        draw.ellipse([(0, 0), (size, size)], fill=color)
    elif shape == "square":
        draw.rectangle([(0, 0), (size, size)], fill=color)
    elif shape == "triangle":
        draw.polygon([(size/2, 0), (0, size), (size, size)], fill=color)
    elif shape == "rectangle":
        draw.rectangle([(0, 0), (size/2, size)], fill=color)
    
    return base64.b64encode(im.tobytes()).decode('utf-8')

# === IMAGE ANALYZER TOOL ===
def analyze_image(image_base64):
    # Simple mock analysis
    return "Analyzed image"

# === MAIN SYSTEM ===
def main():
    user_input = input("Enter your request: ")
    
    # Step 1: Parse input
    parsed = parse_user_input(user_input)
    
    # Step 2: Route task
    route = route_task(parsed)
    
    # Step 3: Execute task
    if route == "shape_generator":
        result = generate_shape(parsed["shape"], parsed["color"], parsed["size"])
    elif route == "image_generator":
        result = generate_image(parsed["color"], parsed["size"])
    else:
        print("Suggestion mode")
        result = execute_task(route, parsed)
        print(result)
        return
    
    # Step 4: Format output
    print(format_response(result, route))

# === PARSER FUNCTIONS ===
def parse_user_input(query):
    import re
    action = "generate" if "generate" in query or "create" in query else "suggest"
    subject = "shape" if "shape" in query else "image" if "image" in query else "unknown"
    shape_match = re.search(r"(circle|square|triangle|rectangle)", query)
    color_match = re.search(r"color:\s*([a-zA-Z]+)", query)
    size_match = re.search(r"size:\s*(\d+)", query)
    
    shape = shape_match.group(1) if shape_match else None
    color = color_match.group(1) if color_match else "blue"
    size = int(size_match.group(1)) if size_match else 512
    
    return {"action": action, "subject": subject, "shape": shape, "color": color, "size": size}

def route_task(parsed):
    if parsed["subject"] == "shape":
        return "shape_generator"
    elif parsed["subject"] == "image":
        return "image_generator"
    else:
        return "suggestion"

def format_response(result, route):
    if route == "shape_generator":
        return f"![Generated Shape](data:image/png;base64,{result})"
    elif route == "image_generator":
        return f"![Generated Image](data:image/png;base64,{result})"
    else:
        return result

# === RUN ===
main()


🎯 How This Works
Test Case 1: Shape Generation
User: Generate a red circle, size 200
Output: ![Generated Shape](data:image/png;base64,base64_string)

Test Case 2: Color Image
User: Create a blue image, size 500
Output: ![Generated Image](data:image/png;base64,base64_string)

Test Case 3: Suggestion Mode
User: What's the best color for a logo?
Output: I recommend using bright and memorable colors like red, blue, or orange. Would you like me to generate a logo design?


💡 Next Steps for Your Project
1. Expand Shape Generator
Add more shapes, gradients, patterns, or text overlay capabilities
2. Add Real Image Generation
Integrate your actual AI image generation tool (Nano Banana Pro, DALL-E, etc.)
3. Add Image Analyzer
Use your image analysis tool to extract features from reference images
4. Add More Tools
Once shapes & images are working, add:
Text generator (for captions)
Video generator
Audio generator

📈 Scalability Path
Phase 1: Shapes & basic images (done) Phase 2: Advanced image generation with prompts Phase 3: Edit existing images Phase 4: Multi-tool workflows (generate + edit + analyze) Phase 5: Video/audio/3D generation

