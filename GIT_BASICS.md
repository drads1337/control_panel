# Basic Git and GitHub Commands for Beginners

## 📚 What is Git and GitHub?

- **Git** - version control system (runs on your computer)
- **GitHub** - cloud service for storing Git repositories (like Google Drive for code)

## 🚀 Initial Setup (one time)

### 1. Installing Git (if not already installed)

**macOS:**
```bash
# Check if Git is installed
git --version

# If not installed, install via Homebrew
brew install git
```

### 2. Git Configuration (one time on your computer)

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email (same as on GitHub)
git config --global user.email "your.email@example.com"

# Check settings
git config --list
```

### 3. Installing GitHub CLI (optional, but convenient)

```bash
# macOS
brew install gh

# Authenticate with GitHub
gh auth login
```

## 📦 Basic Repository Commands

### Checking Status

```bash
# See which files have changed
git status

# See brief status
git status -s
```

### Saving Changes (commit)

```bash
# 1. Add all changed files
git add .

# Or add a specific file
git add filename.py

# 2. Create a commit (save) with a message
git commit -m "Description of what you changed"

# Examples of good messages:
git commit -m "Added user authentication"
git commit -m "Fixed error in balance calculation"
git commit -m "Updated README"
```

### Sending Changes to GitHub

```bash
# Send changes to GitHub (first time)
git push -u origin main

# Send changes (after first time)
git push
```

### Getting Changes from GitHub

```bash
# Download changes from GitHub
git pull

# Or first fetch, then merge
git fetch
git merge
```

## 🔄 Typical Workflow

### Daily Work:

```bash
# 1. Start work - get latest changes
git pull

# 2. Make changes to files (edit code)

# 3. Check what changed
git status

# 4. Add changes
git add .

# 5. Create commit
git commit -m "Description of changes"

# 6. Send to GitHub
git push
```

## 📖 Viewing History and Information

```bash
# View commit history
git log

# Brief history (one line per commit)
git log --oneline

# View changes in file
git diff

# View changes in specific file
git diff filename.py

# See who and when changed a file
git blame filename.py
```

## 🌿 Working with Branches

```bash
# View all branches
git branch

# Create new branch
git branch branch-name

# Switch to branch
git checkout branch-name

# Or create and switch immediately
git checkout -b branch-name

# Delete branch
git branch -d branch-name
```

## ⚠️ Undoing Changes

```bash
# Undo changes in file (before git add)
git checkout -- filename.py

# Remove file from staging (after git add, but before git commit)
git reset HEAD filename.py

# Undo last commit (but keep changes)
git reset --soft HEAD~1

# Undo last commit and all changes (CAREFUL!)
git reset --hard HEAD~1
```

## 🔗 Working with Remote Repository (GitHub)

```bash
# View connected repositories
git remote -v

# Add remote repository
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Change remote repository URL
git remote set-url origin https://github.com/USERNAME/REPO_NAME.git

# Get repository information
git remote show origin
```

## 📥 Cloning Repository

```bash
# Clone repository from GitHub
git clone https://github.com/USERNAME/REPO_NAME.git

# Or via SSH
git clone git@github.com:USERNAME/REPO_NAME.git
```

## 🆘 Troubleshooting

### If you forgot to add something to commit:

```bash
# Add file
git add forgotten_file.py

# Add to last commit
git commit --amend --no-edit
```

### If you need to update last commit message:

```bash
git commit --amend -m "New message"
```

### If conflicts occurred during git pull:

```bash
# Git will show files with conflicts
# Open files and find markers:
# <<<<<<< HEAD
# your code
# =======
# server code
# >>>>>>> branch-name

# After resolving conflicts:
git add .
git commit -m "Resolved conflicts"
git push
```

### If you accidentally committed unwanted files:

```bash
# Remove file from Git (but keep on disk)
git rm --cached filename

# Add to .gitignore
echo "filename" >> .gitignore

# Commit changes
git add .gitignore
git commit -m "Removed unwanted file from repository"
git push
```

## 📝 Useful Aliases (command shortcuts)

Add to `~/.gitconfig` or run:

```bash
# Create commit and push immediately
git config --global alias.pushup '!git add -A && git commit -m "$1" && git push'

# Usage:
git pushup "My message"

# Pretty log
git config --global alias.lg "log --oneline --decorate --graph --all"

# Usage:
git lg
```

## 🎯 Getting Started Checklist

- [ ] Git installed (`git --version`)
- [ ] Name and email configured (`git config --global user.name` and `user.email`)
- [ ] GitHub account created
- [ ] Repository created on GitHub (private)
- [ ] Local repository connected to GitHub (`git remote add origin`)
- [ ] First commit sent (`git push -u origin main`)

## 💡 Tips for Beginners

1. **Commit often** - many small commits are better than one large one
2. **Write clear messages** - you'll forget what you did in a month
3. **Do `git pull` before starting work** - to get latest changes
4. **Check `git status`** before committing - make sure you're adding the right files
5. **Don't commit passwords and keys** - use `.gitignore`
6. **Use branches for experiments** - so you don't break main code

## 🔐 Security

```bash
# NEVER commit:
- Passwords
- API keys
- Secret tokens
- User personal data
- .env files with secrets

# Always add to .gitignore:
.env
*.key
*.pem
secrets/
config.local.py
```

## 📞 Quick Reference

```bash
# Help for command
git help command

# For example:
git help commit
git help push
git help pull
```

---

**Done! Now you know the basics of Git and GitHub. Start with simple commands and gradually master the rest.**
