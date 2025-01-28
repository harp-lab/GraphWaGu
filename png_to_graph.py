from PIL import Image
import json
import numpy as np

def image_to_graph(image_path):
    # Read the image
    img = Image.open(image_path)
    # Convert to RGB if image is in RGBA
    if img.mode == 'RGBA':
        img = img.convert('RGB')
    
    # Convert image to numpy array
    pixels = np.array(img)
    height, width, _ = pixels.shape
    
    # Initialize graph structure
    graph = {
        "nodes": [],
        "edges": []
    }
    
    # Create nodes for each pixel
    for y in range(height):
        for x in range(width):
            pixel = pixels[y, x]
            pixel = [float(pixel[0]) / 255.0, float(pixel[1]) / 255.0, float(pixel[2]) / 255.0, 0.0]
            node_id = y * width + x
            node = {
                "id": node_id,
                "color": pixel  # RGB values
            }
            graph["nodes"].append(node)
            
            # Add edges to neighboring pixels
            # Check right neighbor
            if x < width - 1:
                edge = {
                    "source": node_id,
                    "target": y * width + x + 1
                }
                graph["edges"].append(edge)
            
            # Check bottom neighbor
            if y < height - 1:
                edge = {
                    "source": node_id,
                    "target": (y + 1) * width + x
                }
                graph["edges"].append(edge)
    
    return graph

def save_graph(graph, output_path):
    with open(output_path, 'w') as f:
        json.dump(graph, f, indent=2)

# Example usage
if __name__ == "__main__":
    input_image = "logo-big.png"
    output_json = "a.json"
    
    graph = image_to_graph(input_image)
    save_graph(graph, output_json)