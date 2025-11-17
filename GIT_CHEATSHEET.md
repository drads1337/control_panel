# 📋 Git Cheat Sheet - Most Important Commands

## 🎯 Daily Commands (use most often)

```bash
# 1. Start work - get latest changes
git pull

# 2. See what changed
git status

# 3. Add all changes
git add .

# 4. Save changes
git commit -m "Fixed the logout button, and managment.py"

# 5. Send to GitHub
git push
```

## 📝 Examples of Good Commit Messages

```bash
git commit -m "Added authentication"
git commit -m "Fixed error in balance calculation"
git commit -m "Updated README"
git commit -m "Added search function"
git commit -m "Improved login form design"
```

## 🔧 Setup (one time)

```bash
# Set name
git config --global user.name "Your Name"

# Set email
git config --global user.email "your.email@example.com"

# Connect to GitHub
git remote add origin https://github.com/USERNAME/REPO.git
```

## 📊 Viewing Information

```bash
git status          # What changed
git log --oneline   # Commit history
git diff            # Show changes
```

## ⚠️ Undoing Changes

```bash
# Undo changes in a file
git checkout -- filename.py

# Remove file from staging (before commit)
git reset HEAD filename.py
```

## 🆘 If Something Went Wrong

```bash
# View help
git help command

# Check GitHub connection
git remote -v

# Update connection
git remote set-url origin https://github.com/USERNAME/REPO.git
```

## 💡 Useful Tips

1. ✅ Always do `git pull` before starting work
2. ✅ Commit often with clear messages
3. ✅ Check `git status` before committing
4. ❌ Don't commit passwords and secrets
5. ❌ Don't use `git reset --hard` unless necessary

---

**Use interactive helper:**

```bash
./git-helper.sh
```
