document.addEventListener('DOMContentLoaded', () => {
    // Firebase Authentication and Database
    const auth = window.firebaseAuth;
    const database = window.firebaseDatabase;
    const { ref, set, get, child, onValue } = window.firebaseRefs;
    const { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } = window.firebaseAuthFunctions;
    
    // DOM Elements
    const authOverlay = document.getElementById('auth-overlay');
    const loginLink = document.getElementById('login-link');
    const closeAuthBtns = document.querySelectorAll('.close-auth');
    const loginForm = document.getElementById('login-form');
    const authStatus = document.getElementById('auth-status');
    const feedbackLoginPrompt = document.getElementById('feedback-login-prompt');
    const feedbackForms = document.getElementById('feedback-forms');
    const downloadSection = document.getElementById('download');
    const feedbackOptions = document.querySelectorAll('.feedback-option');
    const bugReportForm = document.getElementById('bug-report-form');
    const featureForm = document.getElementById('feature-form');
    const experienceForm = document.getElementById('experience-form');
    const closeAuthRedirects = document.querySelectorAll('.close-auth-redirect');
    
    // Beta Application Form
    const betaSignupForm = document.getElementById('beta-signup-form');
    
    // Store currently authenticated user info
    let currentUser = null;
    let validatedBetaCode = null;
    
    // Check for existing session
    const checkExistingSession = () => {
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
                            }
                        });
                }
            } catch (e) {
                console.error('Error parsing session data', e);
                localStorage.removeItem('betaUserSession');
            }
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
        
        // Login with beta code
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const betaCode = document.getElementById('beta-code').value.trim();
                const email = document.getElementById('login-email').value.trim();
                
                try {
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
                        showLoginError("Invalid beta code or email. Please try again or apply for access.");
                    }
                } catch (error) {
                    console.error("Login error:", error);
                    showLoginError("An error occurred. Please try again later.");
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
    };
    
    // Show login error
    const showLoginError = (message) => {
        const errorEl = document.createElement('div');
        errorEl.className = 'login-error';
        errorEl.textContent = message;
        
        // Remove any existing error message
        const existingError = loginForm.querySelector('.login-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Insert before the submit button
        loginForm.insertBefore(errorEl, loginForm.querySelector('button[type="submit"]'));
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
        currentUser = null;
        validatedBetaCode = null;
        localStorage.removeItem('betaUserSession');
        updateAuthUI(false);
    };
    
    // Update the UI based on authentication state
    const updateAuthUI = (isLoggedIn) => {
        if (isLoggedIn && currentUser) {
            // Update auth status in nav
            authStatus.classList.add('logged-in');
            loginLink.textContent = `${currentUser.email.split('@')[0]}`;
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
            const feedbackListRef = ref(database, `feedback/${feedbackType}`);
            const newFeedbackRef = child(feedbackListRef, `${Date.now()}`);
            
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
        betaSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(betaSignupForm);
            const formValues = Object.fromEntries(formData.entries());
            
            try {
                // Save application to Firebase
                const applicationsRef = ref(database, 'applications');
                
                // First check if user already exists
                try {
                    // Try to sign in with a temporary password
                    const userCredential = await createUserWithEmailAndPassword(auth, formValues.email, generateTempPassword());
                    const user = userCredential.user;
                    
                    // Send verification email
                    await sendEmailVerification(user, {
                        url: `https://beta.owen.uno?email=${formValues.email}`,
                        handleCodeInApp: false,
                    });
                    
                    // Save application data with the user ID
                    const newApplicationRef = child(applicationsRef, `${Date.now()}`);
                    const applicationData = {
                        name: formValues.name,
                        email: formValues.email,
                        playdateOwner: formValues['playdate-owner'],
                        experience: formValues.experience || '',
                        timestamp: new Date().toISOString(),
                        status: 'pending',
                        project: '8ball',
                        userId: user.uid
                    };
                    
                    await set(newApplicationRef, applicationData);
                    
                } catch (authError) {
                    // If user already exists but needs a new verification email
                    if (authError.code === 'auth/email-already-in-use') {
                        // Check if application already exists for this email
                        const applicationsSnapshot = await get(applicationsRef);
                        let applicationExists = false;
                        
                        if (applicationsSnapshot.exists()) {
                            const applications = applicationsSnapshot.val();
                            Object.values(applications).forEach(app => {
                                if (app.email === formValues.email) {
                                    applicationExists = true;
                                }
                            });
                        }
                        
                        if (!applicationExists) {
                            // Create new application without creating user
                            const newApplicationRef = child(applicationsRef, `${Date.now()}`);
                            const applicationData = {
                                name: formValues.name,
                                email: formValues.email,
                                playdateOwner: formValues['playdate-owner'],
                                experience: formValues.experience || '',
                                timestamp: new Date().toISOString(),
                                status: 'pending',
                                project: '8ball'
                            };
                            
                            await set(newApplicationRef, applicationData);
                        }
                        
                        // Try to send a reset password email instead, which will serve as verification
                        await sendPasswordResetEmail(auth, formValues.email, {
                            url: `https://beta.owen.uno?email=${formValues.email}`,
                            handleCodeInApp: false
                        });
                        
                        throw new Error('email-already-registered-resent');
                    } else {
                        throw authError;
                    }
                }
                
                // Show success message
                const formContainer = betaSignupForm.parentElement;
                formContainer.innerHTML = `
                    <div class="success-message">
                        <h2>🎉 Application Received!</h2>
                        <p>Thanks for applying to test 8ball for Playdate, ${formValues.name}!</p>
                        <p>We've sent a verification email to <strong>${formValues.email}</strong>.</p>
                        <p>Please verify your email to complete your application. If selected, you'll receive a unique beta code within 1-2 business days.</p>
                        <a href="#current-betas" class="btn-primary">Back to Beta Tests</a>
                    </div>
                `;
                
                // Scroll to the success message
                formContainer.scrollIntoView({ behavior: 'smooth' });
                
            } catch (error) {
                console.error("Error with application submission:", error);
                
                let errorMessage = "There was an error submitting your application. Please try again.";
                
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = "You've already applied with this email address. If you haven't received a verification email, check your spam folder.";
                } else if (error.message === 'email-already-registered-resent') {
                    // Custom success message for resending verification
                    const formContainer = betaSignupForm.parentElement;
                    formContainer.innerHTML = `
                        <div class="success-message">
                            <h2>🔄 Verification Email Resent</h2>
                            <p>This email address is already registered for beta testing.</p>
                            <p>We've resent a verification email to <strong>${formValues.email}</strong>.</p>
                            <p>Please check your inbox (and spam folder) to complete verification.</p>
                            <a href="#current-betas" class="btn-primary">Back to Beta Tests</a>
                        </div>
                    `;
                    
                    // Scroll to the success message
                    formContainer.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                
                alert(errorMessage);
            }
        });
    }
    
    // Generate a random temporary password for new user accounts
    function generateTempPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
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