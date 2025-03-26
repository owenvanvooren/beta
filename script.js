document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase App Check with reCAPTCHA v3
    if (typeof firebase !== 'undefined' && firebase.appCheck) {
        const appCheck = firebase.appCheck();
        appCheck.activate('6Ldr8AArAAAAACctZPXwyDAfeLvssTedGAUX27_3', true);
    }

    // Firebase Authentication and Database
    const auth = window.firebaseAuth || (firebase && firebase.auth());
    const database = window.firebaseDatabase || (firebase && firebase.database());
    const { ref, set, get, child, onValue, update, remove } = window.firebaseRefs || {};
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail } = window.firebaseAuthFunctions || {};
    
    // DOM Elements
    const authOverlay = document.getElementById('auth-overlay');
    const loginLink = document.getElementById('login-link');
    const closeAuthBtns = document.querySelectorAll('.close-auth');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authStatus = document.getElementById('auth-status');
    const feedbackLoginPrompt = document.getElementById('feedback-login-prompt');
    const feedbackForms = document.getElementById('feedback-forms');
    const downloadSection = document.getElementById('download');
    const feedbackOptions = document.querySelectorAll('.feedback-option');
    const bugReportForm = document.getElementById('bug-report-form');
    const featureForm = document.getElementById('feature-form');
    const experienceForm = document.getElementById('experience-form');
    const closeAuthRedirects = document.querySelectorAll('.close-auth-redirect');
    const verificationSection = document.getElementById('verification-section');
    const resendVerificationButton = document.getElementById('resend-verification-email');
    const adminPortalSection = document.getElementById('admin-portal');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLogin = document.getElementById('admin-login');
    
    // Beta Application Form
    const betaSignupForm = document.getElementById('beta-signup-form');
    
    // Store currently authenticated user info
    let currentUser = null;
    let validatedBetaCode = null;
    let isAdmin = false;
    
    // Admin Portal Tabs
    const adminTabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Initialize Admin Portal Tabs
    if (adminTabs && tabContents) {
        adminTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and contents
                adminTabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding content
                const tabContentId = tab.getAttribute('data-tab');
                document.getElementById(tabContentId).classList.add('active');
            });
        });
        
        // Set first tab as active by default
        if (adminTabs.length > 0) {
            adminTabs[0].click();
        }
    }
    
    // Check for existing session
    const checkExistingSession = () => {
        // Check auth state with Firebase
        if (auth && auth.onAuthStateChanged) {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    // User is signed in
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        emailVerified: user.emailVerified
                    };
                    
                    // Check if email is verified
                    if (!user.emailVerified) {
                        showVerificationSection();
                    } else {
                        hideVerificationSection();
                        
                        // Load user data
                        loadUserData(user.uid);
                        
                        // Check admin status
                        checkAdminStatus(user.uid);
                    }
                    
                    // Update UI for logged in state
                    updateAuthUI(true);
                } else {
                    // User is signed out
                    fallbackToLocalSession();
                }
            });
        } else {
            // Fallback if Firebase auth not available
            fallbackToLocalSession();
        }
    };
    
    // Fallback to local session
    const fallbackToLocalSession = () => {
        const savedSession = localStorage.getItem('betaUserSession');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session && session.email && session.betaCode && session.expiry > Date.now()) {
                    // Session is still valid
                    validateBetaCode(session.betaCode, session.email)
                        .then(valid => {
                            if (valid) {
                                signInUser(session.email, session.betaCode);
                            } else {
                                // Session is no longer valid
                                localStorage.removeItem('betaUserSession');
                                updateAuthUI(false);
                            }
                        });
                } else {
                    // Session is expired
                    localStorage.removeItem('betaUserSession');
                    updateAuthUI(false);
                }
            } catch (e) {
                console.error('Error parsing session data', e);
                localStorage.removeItem('betaUserSession');
                updateAuthUI(false);
            }
        } else {
            // No session found
            updateAuthUI(false);
        }
    };
    
    // Load user data from Firebase
    const loadUserData = (uid) => {
        if (!database || !ref) return;
        
        const userRef = ref(database, `users/${uid}`);
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                // Update current user
                currentUser = {
                    ...currentUser,
                    betaCode: userData.betaCode,
                    project: userData.project || 'unknown'
                };
                
                // Validate beta code
                if (userData.betaCode) {
                    validateBetaCode(userData.betaCode, currentUser.email);
                }
            }
        }).catch((error) => {
            console.error("Error loading user data:", error);
        });
    };
    
    // Check if user is an admin
    const checkAdminStatus = (uid) => {
        if (!database || !ref) return;
        
        const adminRef = ref(database, `admins/${uid}`);
        get(adminRef).then((snapshot) => {
            if (snapshot.exists() && snapshot.val() === true) {
                isAdmin = true;
                showAdminPortal();
                loadAdminData();
            } else {
                isAdmin = false;
                hideAdminPortal();
            }
        }).catch((error) => {
            console.error("Error checking admin status:", error);
            isAdmin = false;
        });
    };
    
    // Show verification section
    const showVerificationSection = () => {
        if (verificationSection) {
            verificationSection.classList.remove('hidden');
        }
    };
    
    // Hide verification section
    const hideVerificationSection = () => {
        if (verificationSection) {
            verificationSection.classList.add('hidden');
        }
    };
    
    // Show admin portal
    const showAdminPortal = () => {
        if (adminPortalSection) {
            adminPortalSection.classList.remove('hidden');
        }
        
        if (adminLogin) {
            adminLogin.classList.add('hidden');
        }
    };
    
    // Hide admin portal
    const hideAdminPortal = () => {
        if (adminPortalSection) {
            adminPortalSection.classList.add('hidden');
        }
        
        if (adminLogin) {
            adminLogin.classList.remove('hidden');
        }
    };
    
    // Initialize Auth UI
    const initAuth = () => {
        // Open login overlay when login link is clicked
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                authOverlay.classList.add('active');
            });
        }
        
        // Close auth overlay
        closeAuthBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                authOverlay.classList.remove('active');
            });
        });
        
        // Close auth and redirect to signup
        closeAuthRedirects.forEach(link => {
            link.addEventListener('click', (e) => {
                authOverlay.classList.remove('active');
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    setTimeout(() => {
                        targetElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }, 300);
                }
            });
        });
        
        // Login with beta code (old method)
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const betaCode = document.getElementById('beta-code').value.trim();
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value.trim();
                
                try {
                    // If we have Firebase Auth
                    if (auth && signInWithEmailAndPassword) {
                        // Try to sign in with email/password
                        signInWithEmailAndPassword(auth, email, password)
                            .then((userCredential) => {
                                // User signed in successfully
                                const user = userCredential.user;
                                
                                // Check if email is verified
                                if (!user.emailVerified) {
                                    showVerificationSection();
                                }
                                
                                authOverlay.classList.remove('active');
                            })
                            .catch((error) => {
                                console.error("Firebase auth error:", error);
                                
                                // If Firebase auth fails, fall back to beta code validation
                                validateBetaCodeFallback();
                            });
                    } else {
                        // If Firebase Auth is not available, fall back to beta code validation
                        validateBetaCodeFallback();
                    }
                    
                    // Fallback to beta code validation
                    async function validateBetaCodeFallback() {
                        const isValid = await validateBetaCode(betaCode, email);
                        if (isValid) {
                            signInUser(email, betaCode);
                            authOverlay.classList.remove('active');
                            
                            // Save session for 30 days
                            const session = {
                                email: email,
                                betaCode: betaCode,
                                expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
                            };
                            localStorage.setItem('betaUserSession', JSON.stringify(session));
                        } else {
                            showLoginError("Invalid credentials. Please try again or apply for access.");
                        }
                    }
                } catch (error) {
                    console.error("Login error:", error);
                    showLoginError("An error occurred. Please try again later.");
                }
            });
        }
        
        // Signup with beta code
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = signupForm.querySelector('input[type="email"]').value.trim();
                const password = signupForm.querySelector('input[type="password"]').value.trim();
                const betaCode = signupForm.querySelector('input[name="beta-code"]').value.trim();
                
                try {
                    const isValid = await validateBetaCode(betaCode, email);
                    if (isValid) {
                        if (auth && createUserWithEmailAndPassword) {
                            // Create user with Firebase Auth
                            createUserWithEmailAndPassword(auth, email, password)
                                .then((userCredential) => {
                                    // User created successfully
                                    const user = userCredential.user;
                                    
                                    // Send email verification
                                    if (sendEmailVerification) {
                                        sendEmailVerification(user).then(() => {
                                            showVerificationSection();
                                        });
                                    }
                                    
                                    // Save user data to database
                                    if (database && ref && set) {
                                        set(ref(database, `users/${user.uid}`), {
                                            email: email,
                                            betaCode: betaCode,
                                            createdAt: Date.now(),
                                            project: validatedBetaCode ? validatedBetaCode.project : 'unknown'
                                        });
                                    }
                                    
                                    // Mark beta code as used
                                    if (validatedBetaCode && validatedBetaCode.id) {
                                        update(ref(database, `betaCodes/${validatedBetaCode.id}`), {
                                            used: true,
                                            usedBy: email,
                                            usedAt: Date.now()
                                        });
                                    }
                                    
                                    // Close signup overlay
                                    authOverlay.classList.remove('active');
                                })
                                .catch((error) => {
                                    console.error("Firebase signup error:", error);
                                    showSignupError(error.message);
                                });
                        } else {
                            // If Firebase Auth is not available, fall back to local signup
                            signInUser(email, betaCode);
                            authOverlay.classList.remove('active');
                            
                            // Save session for 30 days
                            const session = {
                                email: email,
                                betaCode: betaCode,
                                expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
                            };
                            localStorage.setItem('betaUserSession', JSON.stringify(session));
                        }
                    } else {
                        showSignupError("Invalid beta code. Please check and try again.");
                    }
                } catch (error) {
                    console.error("Signup error:", error);
                    showSignupError("An error occurred. Please try again later.");
                }
            });
        }
        
        // Resend verification email
        if (resendVerificationButton) {
            resendVerificationButton.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (auth && auth.currentUser && sendEmailVerification) {
                    sendEmailVerification(auth.currentUser)
                        .then(() => {
                            alert("Verification email sent! Please check your inbox.");
                        })
                        .catch((error) => {
                            console.error("Error sending verification email:", error);
                            alert("Error sending verification email. Please try again later.");
                        });
                }
            });
        }
        
        // Admin login
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const email = adminLoginForm.querySelector('input[type="email"]').value.trim();
                const password = adminLoginForm.querySelector('input[type="password"]').value.trim();
                
                if (auth && signInWithEmailAndPassword) {
                    signInWithEmailAndPassword(auth, email, password)
                        .then((userCredential) => {
                            const user = userCredential.user;
                            
                            // Check if user is verified
                            if (!user.emailVerified) {
                                alert("Please verify your email address before accessing the admin portal.");
                                return;
                            }
                            
                            // Check if user is an admin
                            checkAdminStatus(user.uid);
                        })
                        .catch((error) => {
                            console.error("Admin login error:", error);
                            alert("Admin login failed: " + error.message);
                        });
                }
            });
        }
        
        // Login links in feedback section
        document.querySelectorAll('.login-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                authOverlay.classList.add('active');
            });
        });
        
        // Initialize auth state
        checkExistingSession();
        
        // Add forgot password functionality
        const forgotPasswordLink = document.getElementById('forgot-password');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                
                const email = prompt("Please enter your email to reset your password:");
                
                if (email && auth && sendPasswordResetEmail) {
                    sendPasswordResetEmail(auth, email)
                        .then(() => {
                            alert("Password reset email sent! Please check your inbox.");
                        })
                        .catch((error) => {
                            console.error("Error sending password reset:", error);
                            alert("Error sending password reset email: " + error.message);
                        });
                }
            });
        }
    };
    
    // Show login error
    const showLoginError = (message) => {
        showFormError(loginForm, message);
    };
    
    // Show signup error
    const showSignupError = (message) => {
        showFormError(signupForm, message);
    };
    
    // Show form error
    const showFormError = (form, message) => {
        if (!form) return;
        
        const errorEl = document.createElement('div');
        errorEl.className = 'login-error';
        errorEl.textContent = message;
        
        // Remove any existing error message
        const existingError = form.querySelector('.login-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Insert before the submit button
        form.insertBefore(errorEl, form.querySelector('button[type="submit"]'));
    };
    
    // Validate beta code against database
    const validateBetaCode = async (code, email) => {
        try {
            // Get the beta codes from the database
            const dbRef = ref(database);
            const snapshot = await get(child(dbRef, 'betaCodes'));
            
            if (snapshot.exists()) {
                const betaCodes = snapshot.val();
                
                // Check if the code exists and is associated with the email
                for (const key in betaCodes) {
                    const betaCode = betaCodes[key];
                    if (betaCode.code === code) {
                        // If the code matches but no email is associated, or email matches
                        if (!betaCode.email || betaCode.email === email) {
                            validatedBetaCode = {
                                id: key,
                                ...betaCode
                            };
                            
                            // If no email was associated, associate it now
                            if (!betaCode.email) {
                                await set(ref(database, `betaCodes/${key}/email`), email);
                                validatedBetaCode.email = email;
                            }
                            
                            return true;
                        }
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error("Error validating beta code:", error);
            return false;
        }
    };
    
    // Sign in user
    const signInUser = (email, betaCode) => {
        currentUser = {
            email: email,
            betaCode: betaCode,
            project: validatedBetaCode ? validatedBetaCode.project : 'unknown'
        };
        
        // Update UI for logged in state
        updateAuthUI(true);
    };
    
    // Sign out user
    const signOutUser = () => {
        // Sign out from Firebase if available
        if (auth && signOut) {
            signOut(auth).catch((error) => {
                console.error("Firebase signout error:", error);
            });
        }
        
        // Clear local data
        currentUser = null;
        validatedBetaCode = null;
        isAdmin = false;
        localStorage.removeItem('betaUserSession');
        
        // Update UI
        updateAuthUI(false);
        hideVerificationSection();
        hideAdminPortal();
    };
    
    // Update the UI based on authentication state
    const updateAuthUI = (isLoggedIn) => {
        if (isLoggedIn && currentUser) {
            // Update auth status in nav
            authStatus.classList.add('logged-in');
            loginLink.textContent = currentUser.email ? currentUser.email.split('@')[0] : 'User';
            loginLink.href = '#account';
            
            // Show feedback forms and hide login prompt
            if (feedbackLoginPrompt) feedbackLoginPrompt.classList.add('hidden');
            if (feedbackForms) feedbackForms.classList.remove('hidden');
            
            // Show download section if it exists
            if (downloadSection) downloadSection.classList.remove('hidden');
            
            // Add sign out option
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown-menu';
            dropdown.innerHTML = `
                <ul>
                    <li><button id="sign-out-btn">Sign Out</button></li>
                </ul>
            `;
            
            // Only add dropdown if it doesn't already exist
            if (!authStatus.querySelector('.dropdown-menu')) {
                authStatus.appendChild(dropdown);
                document.getElementById('sign-out-btn').addEventListener('click', signOutUser);
            }
        } else {
            // Update auth status in nav
            authStatus.classList.remove('logged-in');
            loginLink.textContent = 'Log In';
            loginLink.href = '#login';
            
            // Hide feedback forms and show login prompt
            if (feedbackLoginPrompt) feedbackLoginPrompt.classList.remove('hidden');
            if (feedbackForms) feedbackForms.classList.add('hidden');
            
            // Hide download section
            if (downloadSection) downloadSection.classList.add('hidden');
            
            // Remove dropdown if it exists
            const dropdown = authStatus.querySelector('.dropdown-menu');
            if (dropdown) dropdown.remove();
        }
    };
    
    // Load admin data
    const loadAdminData = () => {
        if (!isAdmin || !database || !ref) return;
        
        // Load applications
        const applicationsRef = ref(database, 'applications');
        get(applicationsRef).then((snapshot) => {
            if (snapshot.exists()) {
                updateApplicationsUI(snapshot.val());
            }
        }).catch((error) => {
            console.error("Error loading applications:", error);
        });
        
        // Load feedback
        const feedbackRef = ref(database, 'feedback');
        get(feedbackRef).then((snapshot) => {
            if (snapshot.exists()) {
                updateFeedbackUI(snapshot.val());
            }
        }).catch((error) => {
            console.error("Error loading feedback:", error);
        });
        
        // Load beta codes
        const betaCodesRef = ref(database, 'betaCodes');
        get(betaCodesRef).then((snapshot) => {
            if (snapshot.exists()) {
                updateBetaCodesUI(snapshot.val());
            }
        }).catch((error) => {
            console.error("Error loading beta codes:", error);
        });
    };
    
    // Update applications UI
    const updateApplicationsUI = (applications) => {
        const applicationsContainer = document.getElementById('applications-list');
        if (!applicationsContainer || !applications) return;
        
        // Clear previous applications
        applicationsContainer.innerHTML = '';
        
        // Convert to array for filtering and sorting
        const applicationsArray = Object.keys(applications).map(key => ({
            id: key,
            ...applications[key]
        }));
        
        // Sort by timestamp (most recent first)
        applicationsArray.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Add application items
        applicationsArray.forEach(application => {
            const applicationItem = document.createElement('div');
            applicationItem.classList.add('admin-item');
            
            // Add status class
            if (application.status) {
                applicationItem.classList.add(application.status.toLowerCase());
            } else {
                applicationItem.classList.add('pending');
            }
            
            // Create application HTML
            applicationItem.innerHTML = `
                <h3>
                    ${application.name} <span class="status-badge status-${application.status ? application.status.toLowerCase() : 'pending'}">${application.status || 'Pending'}</span>
                </h3>
                <div class="admin-item-meta">
                    <span>Email: ${application.email}</span>
                    <span>Applied: ${new Date(application.timestamp).toLocaleString()}</span>
                </div>
                <div class="admin-item-content">
                    ${application.playdateOwner ? `<p><strong>Owns Playdate:</strong> ${application.playdateOwner}</p>` : ''}
                    ${application.experience ? `<p><strong>Experience:</strong> ${application.experience}</p>` : ''}
                </div>
                <div class="admin-item-actions">
                    <button class="btn btn-success approve-application" data-id="${application.id}">Approve</button>
                    <button class="btn btn-danger reject-application" data-id="${application.id}">Reject</button>
                </div>
            `;
            
            applicationsContainer.appendChild(applicationItem);
            
            // Add event listeners for approve/reject buttons
            applicationItem.querySelector('.approve-application').addEventListener('click', () => {
                approveApplication(application.id);
            });
            
            applicationItem.querySelector('.reject-application').addEventListener('click', () => {
                rejectApplication(application.id);
            });
        });
    };
    
    // Update feedback UI
    const updateFeedbackUI = (allFeedback) => {
        const feedbackContainer = document.getElementById('feedback-list');
        if (!feedbackContainer || !allFeedback) return;
        
        // Clear previous feedback
        feedbackContainer.innerHTML = '';
        
        // Process all feedback into a flat array
        const feedbackArray = [];
        
        // Process all feedback
        Object.keys(allFeedback).forEach(feedbackType => {
            const typeFeedback = allFeedback[feedbackType];
            
            Object.keys(typeFeedback).forEach(feedbackId => {
                const feedback = typeFeedback[feedbackId];
                feedbackArray.push({
                    id: feedbackId,
                    type: feedbackType,
                    ...feedback
                });
            });
        });
        
        // Sort by timestamp (most recent first)
        feedbackArray.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Add feedback items
        feedbackArray.forEach(feedback => {
            const feedbackItem = document.createElement('div');
            feedbackItem.classList.add('admin-item');
            
            // Add status class
            feedbackItem.classList.add(feedback.status ? feedback.status.toLowerCase() : 'new');
            
            // Get the title based on feedback type
            let title = '';
            if (feedback.type === 'bugs') {
                title = feedback.title || 'Bug Report';
            } else if (feedback.type === 'features') {
                title = feedback.title || 'Feature Request';
            } else {
                title = `${feedback.rating ? feedback.rating + '/5 ' : ''}Experience Feedback`;
            }
            
            // Create feedback HTML
            feedbackItem.innerHTML = `
                <h3>
                    ${title} <span class="status-badge status-${feedback.status ? feedback.status.toLowerCase() : 'new'}">${feedback.status || 'New'}</span>
                </h3>
                <div class="admin-item-meta">
                    <span>User: ${feedback.submittedBy || 'Unknown'}</span>
                    <span>Type: ${feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1)}</span>
                    <span>Submitted: ${new Date(feedback.timestamp).toLocaleString()}</span>
                </div>
                <div class="admin-item-content">
                    <p>${feedback.details || feedback.message || ''}</p>
                </div>
                <div class="admin-item-actions">
                    <button class="btn mark-read" data-type="${feedback.type}" data-id="${feedback.id}">Mark as Read</button>
                    <button class="btn btn-danger delete-feedback" data-type="${feedback.type}" data-id="${feedback.id}">Delete</button>
                </div>
            `;
            
            feedbackContainer.appendChild(feedbackItem);
            
            // Add event listeners for action buttons
            feedbackItem.querySelector('.mark-read').addEventListener('click', (e) => {
                const type = e.target.getAttribute('data-type');
                const id = e.target.getAttribute('data-id');
                markFeedbackAsRead(type, id);
            });
            
            feedbackItem.querySelector('.delete-feedback').addEventListener('click', (e) => {
                const type = e.target.getAttribute('data-type');
                const id = e.target.getAttribute('data-id');
                deleteFeedback(type, id);
            });
        });
    };
    
    // Update beta codes UI
    const updateBetaCodesUI = (betaCodes) => {
        const betaCodesContainer = document.getElementById('beta-codes-list');
        if (!betaCodesContainer || !betaCodes) return;
        
        // Clear previous beta codes
        betaCodesContainer.innerHTML = '';
        
        // Convert to array for sorting
        const betaCodesArray = Object.keys(betaCodes).map(key => ({
            id: key,
            code: betaCodes[key].code || key,
            ...betaCodes[key]
        }));
        
        // Sort by creation date (most recent first)
        betaCodesArray.sort((a, b) => {
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        
        // Add beta code items
        betaCodesArray.forEach(betaCode => {
            const betaCodeItem = document.createElement('div');
            betaCodeItem.classList.add('admin-item');
            
            // Add status class
            betaCodeItem.classList.add(betaCode.used ? 'used' : 'available');
            
            // Get the code (either from code property or id)
            const code = betaCode.code || betaCode.id;
            
            // Create beta code HTML
            betaCodeItem.innerHTML = `
                <h3>
                    Beta Code <span class="status-badge ${betaCode.used ? 'status-approved' : 'status-new'}">${betaCode.used ? 'Used' : 'Available'}</span>
                </h3>
                <div class="beta-code-display">
                    ${code}
                    <button class="copy-code" data-code="${code}"><i class="fas fa-copy"></i></button>
                </div>
                <div class="admin-item-meta">
                    ${betaCode.createdAt ? `<span>Created: ${new Date(betaCode.createdAt).toLocaleString()}</span>` : ''}
                    ${betaCode.project ? `<span>Project: ${betaCode.project}</span>` : ''}
                    ${betaCode.used && betaCode.usedBy ? `<span>Used by: ${betaCode.usedBy}</span>` : ''}
                    ${betaCode.usedAt ? `<span>Used on: ${new Date(betaCode.usedAt).toLocaleString()}</span>` : ''}
                </div>
                <div class="admin-item-actions">
                    <button class="btn btn-danger delete-code" data-id="${betaCode.id}">Delete</button>
                </div>
            `;
            
            betaCodesContainer.appendChild(betaCodeItem);
            
            // Add event listener for copy button
            betaCodeItem.querySelector('.copy-code').addEventListener('click', (e) => {
                const code = e.target.closest('.copy-code').getAttribute('data-code');
                copyToClipboard(code);
            });
            
            // Add event listener for delete button
            betaCodeItem.querySelector('.delete-code').addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                deleteBetaCode(id);
            });
        });
    };
    
    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };
    
    // Approve application
    const approveApplication = (applicationId) => {
        if (!isAdmin || !database || !ref || !update) return;
        
        // Generate a new beta code
        const betaCode = generateBetaCode();
        
        // Get application data
        get(ref(database, `applications/${applicationId}`)).then((snapshot) => {
            if (snapshot.exists()) {
                const application = snapshot.val();
                
                // Create beta code in database
                set(ref(database, `betaCodes/${betaCode}`), {
                    code: betaCode,
                    createdAt: Date.now(),
                    used: false,
                    project: application.project || '8ball',
                    forUser: application.email
                }).then(() => {
                    // Update application status
                    update(ref(database, `applications/${applicationId}`), {
                        status: 'Approved',
                        approvedAt: Date.now(),
                        betaCode: betaCode
                    }).then(() => {
                        alert(`Application approved! Beta code ${betaCode} generated for ${application.email}`);
                        
                        // Reload admin data
                        loadAdminData();
                    });
                });
            }
        }).catch((error) => {
            console.error("Error approving application:", error);
            alert("Error approving application. Please try again.");
        });
    };
    
    // Reject application
    const rejectApplication = (applicationId) => {
        if (!isAdmin || !database || !ref || !update) return;
        
        // Update application status
        update(ref(database, `applications/${applicationId}`), {
            status: 'Rejected',
            rejectedAt: Date.now()
        }).then(() => {
            // Get application data for notification
            get(ref(database, `applications/${applicationId}`)).then((snapshot) => {
                if (snapshot.exists()) {
                    const application = snapshot.val();
                    alert(`Application from ${application.email} has been rejected.`);
                }
                
                // Reload admin data
                loadAdminData();
            });
        }).catch((error) => {
            console.error("Error rejecting application:", error);
            alert("Error rejecting application. Please try again.");
        });
    };
    
    // Mark feedback as read
    const markFeedbackAsRead = (feedbackType, feedbackId) => {
        if (!isAdmin || !database || !ref || !update) return;
        
        // Update feedback status
        update(ref(database, `feedback/${feedbackType}/${feedbackId}`), {
            status: 'Read',
            readAt: Date.now()
        }).then(() => {
            // Reload admin data
            loadAdminData();
        }).catch((error) => {
            console.error("Error marking feedback as read:", error);
            alert("Error marking feedback as read. Please try again.");
        });
    };
    
    // Delete feedback
    const deleteFeedback = (feedbackType, feedbackId) => {
        if (!isAdmin || !database || !ref || !remove) return;
        
        if (confirm("Are you sure you want to delete this feedback?")) {
            // Delete feedback
            remove(ref(database, `feedback/${feedbackType}/${feedbackId}`))
                .then(() => {
                    // Reload admin data
                    loadAdminData();
                }).catch((error) => {
                    console.error("Error deleting feedback:", error);
                    alert("Error deleting feedback. Please try again.");
                });
        }
    };
    
    // Delete beta code
    const deleteBetaCode = (betaCodeId) => {
        if (!isAdmin || !database || !ref || !remove) return;
        
        if (confirm("Are you sure you want to delete this beta code?")) {
            // Delete beta code
            remove(ref(database, `betaCodes/${betaCodeId}`))
                .then(() => {
                    // Reload admin data
                    loadAdminData();
                }).catch((error) => {
                    console.error("Error deleting beta code:", error);
                    alert("Error deleting beta code. Please try again.");
                });
        }
    };
    
    // Generate new beta code
    const generateBetaCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        
        // Generate 5 groups of 4 characters
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 4; j++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            if (i < 4) {
                code += '-';
            }
        }
        
        return code;
    };
    
    // Generate multiple beta codes
    const generateMultipleBetaCodes = (count, project) => {
        if (!isAdmin || !database || !ref || !set) return;
        
        const codes = [];
        
        for (let i = 0; i < count; i++) {
            const code = generateBetaCode();
            codes.push(code);
            
            // Save to database
            set(ref(database, `betaCodes/${code}`), {
                code: code,
                createdAt: Date.now(),
                used: false,
                project: project || '8ball'
            });
        }
        
        // Reload admin data
        loadAdminData();
        
        return codes;
    };
    
    // Initialize feedback forms
    const initFeedbackForms = () => {
        // Make feedback options expandable
        feedbackOptions.forEach(option => {
            const heading = option.querySelector('h3');
            heading.addEventListener('click', () => {
                // Close any other active options
                feedbackOptions.forEach(otherOption => {
                    if (otherOption !== option && otherOption.classList.contains('active')) {
                        otherOption.classList.remove('active');
                    }
                });
                
                // Toggle this option
                option.classList.toggle('active');
            });
        });
        
        // Handle bug report submission
        if (bugReportForm) {
            bugReportForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!currentUser) return;
                
                const bugData = {
                    title: bugReportForm.querySelector('#bug-title').value,
                    details: bugReportForm.querySelector('#bug-details').value,
                    severity: bugReportForm.querySelector('#bug-severity').value,
                    submittedBy: currentUser.email,
                    project: currentUser.project,
                    timestamp: new Date().toISOString(),
                    status: 'new'
                };
                
                // Save to Firebase
                submitFeedback('bugs', bugData, bugReportForm);
            });
        }
        
        // Handle feature suggestion submission
        if (featureForm) {
            featureForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!currentUser) return;
                
                const featureData = {
                    title: featureForm.querySelector('#feature-title').value,
                    details: featureForm.querySelector('#feature-details').value,
                    submittedBy: currentUser.email,
                    project: currentUser.project,
                    timestamp: new Date().toISOString(),
                    status: 'under-review'
                };
                
                // Save to Firebase
                submitFeedback('features', featureData, featureForm);
            });
        }
        
        // Handle experience feedback submission
        if (experienceForm) {
            experienceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!currentUser) return;
                
                const ratingInputs = experienceForm.querySelectorAll('input[name="rating"]');
                let rating = 0;
                ratingInputs.forEach(input => {
                    if (input.checked) {
                        rating = parseInt(input.value);
                    }
                });
                
                const experienceData = {
                    details: experienceForm.querySelector('#experience-details').value,
                    rating: rating,
                    submittedBy: currentUser.email,
                    project: currentUser.project,
                    timestamp: new Date().toISOString()
                };
                
                // Save to Firebase
                submitFeedback('experiences', experienceData, experienceForm);
            });
        }
    };
    
    // Submit feedback to Firebase
    const submitFeedback = (feedbackType, data, form) => {
        try {
            if (!database || !ref || !set) throw new Error("Database not available");
            
            const feedbackListRef = ref(database, `feedback/${feedbackType}`);
            const newFeedbackRef = child(feedbackListRef, `${Date.now()}`);
            
            grecaptcha.execute('6Ldr8AArAAAAACctZPXwyDAfeLvssTedGAUX27_3', {action: 'login'}).then(function(token) {
                // Add token to your form
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'g-recaptcha-response';
                input.value = token;
                form.appendChild(input);
                // Continue with form submission
            });
            
            set(newFeedbackRef, data)
                .then(() => {
                    // Clear the form
                    form.reset();
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.className = 'feedback-success';
                    successMsg.textContent = 'Thank you for your feedback!';
                    
                    // Remove existing success message if any
                    const existingMsg = form.querySelector('.feedback-success');
                    if (existingMsg) existingMsg.remove();
                    
                    form.appendChild(successMsg);
                    
                    // Hide success message after 3 seconds
                    setTimeout(() => {
                        successMsg.remove();
                        const option = form.closest('.feedback-option');
                        if (option) option.classList.remove('active');
                    }, 3000);
                })
                .catch(error => {
                    console.error("Error submitting feedback:", error);
                    alert("There was an error submitting your feedback. Please try again.");
                });
        } catch (error) {
            console.error("Error with feedback submission:", error);
            alert("There was an error submitting your feedback. Please try again.");
        }
    };
    
    // Beta Application Form
    if (betaSignupForm) {
        betaSignupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(betaSignupForm);
            const formValues = Object.fromEntries(formData.entries());
            
            // Save application to Firebase
            try {
                if (!database || !ref || !set) throw new Error("Database not available");
                
                const applicationsRef = ref(database, 'applications');
                const newApplicationRef = child(applicationsRef, `${Date.now()}`);
                
                const applicationData = {
                    name: formValues.name,
                    email: formValues.email,
                    playdateOwner: formValues['playdate-owner'],
                    experience: formValues.experience || '',
                    timestamp: new Date().toISOString(),
                    status: 'Pending',
                    project: '8ball'
                };
                
                set(newApplicationRef, applicationData)
                    .then(() => {
                        // Show success message
                        const formContainer = betaSignupForm.parentElement;
                        formContainer.innerHTML = `
                            <div class="success-message">
                                <h2>🎉 Application Received!</h2>
                                <p>Thanks for applying to test 8ball for Playdate, ${formValues.name}!</p>
                                <p>We've sent a confirmation email to <strong>${formValues.email}</strong> with more details.</p>
                                <p>If selected, you'll receive a unique beta code via email within 1-2 business days.</p>
                                <a href="#current-betas" class="btn-primary">Back to Beta Tests</a>
                            </div>
                        `;
                        
                        // Scroll to the success message
                        formContainer.scrollIntoView({ behavior: 'smooth' });
                    })
                    .catch(error => {
                        console.error("Error saving application:", error);
                        alert("There was an error submitting your application. Please try again.");
                    });
            } catch (error) {
                console.error("Error with application submission:", error);
                alert("There was an error submitting your application. Please try again.");
            }
        });
    }
    
    // Generate beta codes button
    const generateCodesButton = document.getElementById('generate-codes');
    if (generateCodesButton) {
        generateCodesButton.addEventListener('click', () => {
            if (!isAdmin) return;
            
            const count = parseInt(prompt("How many beta codes do you want to generate?", "10")) || 10;
            const project = prompt("For which project? (Default: 8ball)", "8ball") || "8ball";
            
            const generatedCodes = generateMultipleBetaCodes(count, project);
            if (generatedCodes && generatedCodes.length > 0) {
                alert(`${generatedCodes.length} beta codes generated successfully for project ${project}!`);
            }
        });
    }
    
    // Notify Me functionality for coming soon projects
    const notifyButtons = document.querySelectorAll('a[href="#notify-me"]');
    notifyButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Create a modal for email collection
            const modal = document.createElement('div');
            modal.className = 'notify-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3>Get Notified</h3>
                    <p>We'll let you know as soon as this beta is ready!</p>
                    <form id="notify-form">
                        <div class="form-group">
                            <label for="notify-email">Email</label>
                            <input type="email" id="notify-email" name="email" required>
                        </div>
                        <button type="submit" class="btn-primary">Notify Me</button>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add CSS for the modal
            const style = document.createElement('style');
            style.textContent = `
                .notify-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                
                .modal-content {
                    background-color: white;
                    padding: 2rem;
                    border-radius: 12px;
                    max-width: 500px;
                    width: 90%;
                    position: relative;
                    transform: translateY(20px);
                    transition: transform 0.3s ease;
                }
                
                .close-modal {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    font-size: 1.5rem;
                    cursor: pointer;
                }
                
                .modal-active {
                    opacity: 1;
                }
                
                .modal-active .modal-content {
                    transform: translateY(0);
                }
            `;
            
            document.head.appendChild(style);
            
            // Show the modal with animation
            setTimeout(() => {
                modal.classList.add('modal-active');
            }, 10);
            
            // Close modal functionality
            const closeModal = document.querySelector('.close-modal');
            closeModal.addEventListener('click', () => {
                modal.classList.remove('modal-active');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            });
            
            // Notify form submission
            const notifyForm = document.getElementById('notify-form');
            notifyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('notify-email').value;
                
                // Save notification request to Firebase
                try {
                    if (!database || !ref || !set) throw new Error("Database not available");
                    
                    const notificationsRef = ref(database, 'notifications');
                    const newNotificationRef = child(notificationsRef, `${Date.now()}`);
                    
                    const notificationData = {
                        email: email,
                        timestamp: new Date().toISOString(),
                        project: 'mystery-macos' // Hardcoded for now, but could be dynamic
                    };
                    
                    set(newNotificationRef, notificationData)
                        .then(() => {
                            // Update the modal content
                            const modalContent = document.querySelector('.modal-content');
                            modalContent.innerHTML = `
                                <h3>Thanks!</h3>
                                <p>We'll email <strong>${email}</strong> when this beta is ready to test.</p>
                                <button class="btn-primary close-modal-btn">Close</button>
                            `;
                            
                            const closeBtn = document.querySelector('.close-modal-btn');
                            closeBtn.addEventListener('click', () => {
                                modal.classList.remove('modal-active');
                                setTimeout(() => {
                                    modal.remove();
                                }, 300);
                            });
                        })
                        .catch(error => {
                            console.error("Error saving notification request:", error);
                            alert("There was an error submitting your notification request. Please try again.");
                        });
                } catch (error) {
                    console.error("Error with notification submission:", error);
                    alert("There was an error submitting your notification request. Please try again.");
                }
            });
        });
    });
    
    // Fun easter egg - clicking the logo
    const logo = document.querySelector('.logo a');
    if (logo) {
        let clickCount = 0;
        logo.addEventListener('click', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                clickCount++;
                
                if (clickCount >= 5) {
                    // After 5 ctrl+clicks, trigger the easter egg
                    document.body.classList.add('party-mode');
                    
                    // Add some fun styles
                    const partyStyle = document.createElement('style');
                    partyStyle.textContent = `
                        @keyframes partyColors {
                            0% { background-color: var(--primary-color); }
                            25% { background-color: var(--secondary-color); }
                            50% { background-color: var(--accent-color); }
                            75% { background-color: var(--dark-color); }
                            100% { background-color: var(--primary-color); }
                        }
                        
                        .party-mode {
                            animation: partyColors 10s infinite;
                        }
                        
                        .party-mode * {
                            animation: shake 0.5s infinite;
                        }
                    `;
                    
                    document.head.appendChild(partyStyle);
                    
                    // Reset after 5 seconds
                    setTimeout(() => {
                        document.body.classList.remove('party-mode');
                        clickCount = 0;
                    }, 5000);
                }
            }
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#notify-me' || 
                this.getAttribute('href') === '#login' ||
                this.classList.contains('close-auth-redirect')) {
                return; // Skip processing, handled by other handlers
            }
            
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Initialize everything
    initAuth();
    initFeedbackForms();
}); 