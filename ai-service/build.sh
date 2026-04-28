#!/bin/bash
set -e
# Install PyTorch CPU-only (much smaller than full torch)
pip install torch==2.3.0 --index-url https://download.pytorch.org/whl/cpu
# Install remaining dependencies
pip install -r requirements.txt
