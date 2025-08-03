#!/usr/bin/env python3
"""
Simple script to create basic icons for the extension.
Run with: python create_icons.py
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a blue circle background
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], 
                fill=(41, 98, 255, 255), outline=(30, 70, 200, 255), width=2)
    
    # Draw chart-like lines
    center_x, center_y = size // 2, size // 2
    line_width = max(1, size // 16)
    
    # Draw upward trending line
    points = [
        (size * 0.25, size * 0.7),
        (size * 0.4, size * 0.5),
        (size * 0.6, size * 0.4),
        (size * 0.75, size * 0.3)
    ]
    
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=(255, 255, 255, 255), width=line_width)
    
    # Draw small dots at data points
    for point in points:
        dot_size = max(1, size // 20)
        draw.ellipse([point[0] - dot_size, point[1] - dot_size, 
                     point[0] + dot_size, point[1] + dot_size], 
                    fill=(255, 255, 255, 255))
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename}")

if __name__ == "__main__":
    # Create icons directory if it doesn't exist
    os.makedirs('icons', exist_ok=True)
    
    # Create different sized icons
    create_icon(16, 'icons/icon16.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(128, 'icons/icon128.png')
    
    print("All icons created successfully!")