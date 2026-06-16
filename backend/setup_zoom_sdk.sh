#!/bin/bash
# Zoom SDK Bot Setup Script
# This script helps set up the Zoom SDK bot for the meeting-joiner service

set -e  # Exit on error

echo "================================================"
echo "Zoom SDK Bot Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

print_info "Detected OS: $OS"
echo ""

# Step 1: Check Python version
echo "Step 1: Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 10 ]; then
    print_success "Python $PYTHON_VERSION (>= 3.10 required)"
else
    print_error "Python 3.10 or higher required. Found: $PYTHON_VERSION"
    exit 1
fi
echo ""

# Step 2: Install system dependencies
echo "Step 2: Installing system dependencies..."
if [ "$OS" == "linux" ]; then
    print_info "Installing Linux dependencies (requires sudo)..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y \
            libgtk-3-dev \
            gobject-introspection \
            libgirepository1.0-dev \
            python3-gi \
            python3-gi-cairo \
            pkg-config
        print_success "System dependencies installed"
    elif command -v yum &> /dev/null; then
        sudo yum install -y \
            gtk3-devel \
            gobject-introspection-devel \
            python3-gobject \
            python3-gobject-base
        print_success "System dependencies installed"
    else
        print_error "Package manager not found. Please install dependencies manually."
        exit 1
    fi
elif [ "$OS" == "macos" ]; then
    print_info "Installing macOS dependencies (requires Homebrew)..."
    if command -v brew &> /dev/null; then
        brew install gtk+3 pygobject3 gobject-introspection pkg-config
        print_success "System dependencies installed"
    else
        print_error "Homebrew not found. Please install Homebrew first: https://brew.sh/"
        exit 1
    fi
fi
echo ""

# Step 3: Check for Zoom SDK
echo "Step 3: Checking Zoom Meeting SDK..."
if python3 -c "import zoom_meeting_sdk" 2>/dev/null; then
    print_success "Zoom Meeting SDK is already installed"
else
    print_warning "Zoom Meeting SDK not found"
    print_info "The SDK must be installed from py-zoom-meeting-sdk package"
    print_info "Please run: cd /path/to/py-zoom-meeting-sdk && pip install ."
    
    read -p "Do you want to specify the path to py-zoom-meeting-sdk now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter path to py-zoom-meeting-sdk directory: " SDK_PATH
        if [ -d "$SDK_PATH" ]; then
            print_info "Installing Zoom Meeting SDK from $SDK_PATH..."
            cd "$SDK_PATH"
            pip install .
            cd -
            print_success "Zoom Meeting SDK installed"
        else
            print_error "Directory not found: $SDK_PATH"
            exit 1
        fi
    else
        print_warning "Skipping SDK installation. Remember to install it manually!"
    fi
fi
echo ""

# Step 4: Install Python dependencies
echo "Step 4: Installing Python dependencies..."
if [ -f "pyproject.toml" ]; then
    if command -v poetry &> /dev/null; then
        print_info "Installing dependencies with Poetry..."
        poetry install
        print_success "Python dependencies installed"
    else
        print_warning "Poetry not found. Installing with pip..."
        pip install pyjwt pygobject openai
        print_success "Core dependencies installed"
    fi
else
    print_error "pyproject.toml not found. Are you in the meeting-joiner directory?"
    exit 1
fi
echo ""

# Step 5: Check environment variables
echo "Step 5: Checking environment variables..."
ENV_FILE=".env"
REQUIRED_VARS=("ZOOM_APP_CLIENT_ID" "ZOOM_APP_CLIENT_SECRET" "OPENAI_API_KEY")
MISSING_VARS=()

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    for VAR in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!VAR}" ]; then
            MISSING_VARS+=("$VAR")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        print_success "All required environment variables are set"
    else
        print_warning "Missing environment variables: ${MISSING_VARS[*]}"
        print_info "Please add these to your .env file:"
        for VAR in "${MISSING_VARS[@]}"; do
            echo "  $VAR=your_value_here"
        done
    fi
else
    print_warning ".env file not found"
    print_info "Creating .env template..."
    cat > .env << EOF
# Zoom App Credentials
# Get these from https://marketplace.zoom.us/
ZOOM_APP_CLIENT_ID=your_zoom_app_client_id
ZOOM_APP_CLIENT_SECRET=your_zoom_app_client_secret

# OpenAI API Key (for transcription)
OPENAI_API_KEY=your_openai_api_key
EOF
    print_success ".env template created. Please fill in your credentials."
fi
echo ""

# Step 6: Verify installation
echo "Step 6: Verifying installation..."
echo "Checking imports..."

python3 << EOF
try:
    import gi
    gi.require_version('GLib', '2.0')
    from gi.repository import GLib
    print("✓ GLib import successful")
except Exception as e:
    print(f"✗ GLib import failed: {e}")
    exit(1)

try:
    import jwt
    print("✓ JWT import successful")
except Exception as e:
    print(f"✗ JWT import failed: {e}")
    exit(1)

try:
    from openai import OpenAI
    print("✓ OpenAI import successful")
except Exception as e:
    print(f"✗ OpenAI import failed: {e}")
    exit(1)

try:
    import zoom_meeting_sdk
    print("✓ Zoom Meeting SDK import successful")
except Exception as e:
    print("⚠ Zoom Meeting SDK import failed (needs manual installation)")
    print("  Please install from: /path/to/py-zoom-meeting-sdk")
EOF

echo ""

# Final summary
echo "================================================"
echo "Setup Summary"
echo "================================================"
print_success "System dependencies installed"
print_success "Python dependencies installed"
print_info "Please ensure:"
echo "  1. Zoom Meeting SDK is installed"
echo "  2. Environment variables are configured in .env"
echo "  3. Zoom app credentials are obtained from marketplace.zoom.us"
echo ""
print_info "Next steps:"
echo "  1. Fill in .env file with your credentials"
echo "  2. Test the installation:"
echo "     cd src/bot/zoom_sdk_bot"
echo "     python3 zoom_bot_runner.py <meeting_id> <password>"
echo ""
print_success "Setup complete!"
