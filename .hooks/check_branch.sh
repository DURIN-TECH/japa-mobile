#!/bin/bash

# Get the current branch name
current_branch=$(git symbolic-ref --short HEAD)

# List of protected branches
protected_branches=("main" "dev")

# Check if current branch is in protected branches
for branch in "${protected_branches[@]}"; do
    if [ "$current_branch" = "$branch" ]; then
        echo "ERROR: Direct commits to $branch branch are not allowed."
        echo "Please create a feature branch and submit a pull request."
        exit 1
    fi
done

exit 0
