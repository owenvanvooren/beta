document.addEventListener('DOMContentLoaded', () => {
    // Firebase Authentication and Database
    const auth = window.firebaseAuth;
    const database = window.firebaseDatabase;
    const { ref, set, get, child, onValue } = window.firebaseRefs;
    const { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendEmailVerification } = window.firebaseAuthFunctions;
    
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
    const signupMessage = document.getElementById('signup-message');
    
    // Store currently authenticated user info
    let currentUser = null;
    let validatedBetaCode = null;
    
    // DOM Elements (Add new elements)
    const betaCodeGroup = document.getElementById('beta-code-group');
    const loginEmailGroup = document.getElementById('login-email-group');
    const loginPasswordGroup = document.getElementById('login-password-group');
    const adminLoginSwitcher = document.getElementById('admin-login-switcher');
    const adminLoginLink = document.getElementById('admin-login-link');
    const loginSectionTitle = document.querySelector('#login-section h2');
    const loginSectionInstructions = document.querySelector('#login-section p');
    const loginSubmitButton = loginForm.querySelector('button[type="submit"]');
    const signupLinkAuthMessage = loginForm.nextElementSibling;

    let isAdminLoginMode = false;
    
    // DOM Elements (Get beta code input element)
    const betaCodeInput = document.getElementById('beta-code'); // ✅ Get the beta code input element

    // DOM Elements (Get beta login link element)
    const betaLoginLink = document.getElementById('beta-login-link'); // ✅ Get the beta login link element

    // DOM Elements (Admin Portal - Add new lists)
    const bugReportsList = document.getElementById('bug-reports-list');
    const featureRequestsList = document.getElementById('feature-requests-list');
    const userRatingsList = document.getElementById('user-ratings-list');
    const viewWebsiteBtn = document.getElementById('view-website-btn'); // ✅ Get the "View Website" button

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
                if (authOverlay) {
                    authOverlay.classList.remove('active');
                } else {
                    console.warn('authOverlay element not found, cannot close overlay.');
                }
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
        
        // Admin Login Switcher Link Event Listener
        if (adminLoginLink) {
            adminLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAdminLoginMode();
            });
        }
        
        // Beta Login Link Event Listener
        if (betaLoginLink) {
            betaLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAdminLoginMode(); // Call toggleAdminLoginMode to switch back
            });
        }
        
        // Login with beta code (Modified to handle both beta code and admin login)
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('login-email').value.trim();

                if (isAdminLoginMode) {
                    // **Admin Login Flow**
                    const password = document.getElementById('login-password').value.trim();

                    adminLoginMessage.textContent = 'Admin Logging in...';
                    adminLoginMessage.className = 'form-message';

                    try {
                        const userCredential = await signInWithEmailAndPassword(auth, email, password);
                        adminLoginMessage.textContent = 'Admin login successful!';
                        adminLoginMessage.className = 'form-message success';
                        authOverlay.classList.remove('active');
                        signInUser(email, null); // Call signInUser for admin login, betaCode is null
                        alert('Admin login successful!');
                    } catch (error) {
                        console.error("Admin login error:", error);
                        adminLoginMessage.textContent = 'Invalid admin credentials. Please try again.';
                        adminLoginMessage.className = 'form-message error';
                        alert('Admin login failed. Check credentials and console. Error: ' + error.message);
                    }
                } else {
                    // **Beta Code Login Flow (Existing Logic)**
                    const betaCode = document.getElementById('beta-code').value.trim();

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
    
    // Function to toggle admin login mode (Modified to show/hide beta login link)
    const toggleAdminLoginMode = () => {
        isAdminLoginMode = !isAdminLoginMode;

        if (isAdminLoginMode) {
            // Switch to Admin Login Mode
            loginSectionTitle.textContent = 'Admin Login';
            loginSectionInstructions.textContent = 'Enter your admin email and password.';
            betaCodeGroup.classList.add('hidden');
            loginPasswordGroup.classList.remove('hidden');
            loginSubmitButton.textContent = 'Admin Log In';
            signupLinkAuthMessage.classList.add('hidden');
            betaCodeInput.removeAttribute('required');
            betaLoginLink.classList.remove('hidden'); // ✅ Show "Back to Beta Login" link
            adminLoginLink.classList.add('hidden'); // ✅ Hide "Admin Login" link to prevent double-switching
        } else {
            // Switch back to Beta Code Login Mode (Default)
            loginSectionTitle.textContent = 'Log In to Beta Access';
            loginSectionInstructions.textContent = 'Enter your beta code to access test builds and submit feedback.';
            betaCodeGroup.classList.remove('hidden');
            loginPasswordGroup.classList.add('hidden');
            loginSubmitButton.textContent = 'Log In';
            signupLinkAuthMessage.classList.remove('hidden');
            betaCodeInput.setAttribute('required', '');
            betaLoginLink.classList.add('hidden'); // ✅ Hide "Back to Beta Login" link
            adminLoginLink.classList.remove('hidden'); // ✅ Show "Admin Login" link
        }
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
    
    // Sign in user (Modified to handle admin detection)
    const signInUser = (email, betaCode) => {
        currentUser = {
            email: email,
            betaCode: betaCode,
            project: validatedBetaCode ? validatedBetaCode.project : 'unknown'
        };

        const adminEmails = ['owen@owen.uno'];
        if (adminEmails.includes(email)) {
            currentUser.isAdmin = true;
            showAdminDashboard(); // Function to show admin dashboard
        } else {
            currentUser.isAdmin = false;
        }

        // Update UI for logged in state
        updateAuthUI(true, currentUser.isAdmin);
    };

    // Function to show admin dashboard (Enhanced to load applications and feedback data)
    const showAdminDashboard = () => {
        adminPortal.classList.remove('initially-hidden');
        adminPortal.classList.remove('hidden');
        adminPortal.classList.add('active');
        adminDashboard.classList.remove('hidden');
        loadBetaApplications(); // Call function to load applications
        loadBugReports();        // Load bug reports
        loadFeatureRequests();   // Load feature requests
        loadUserRatings();       // Load user ratings
        updateAuthUI(true, currentUser.isAdmin); // ✅ Indicate admin login to updateAuthUI
    };

    // Function to load beta applications from Firebase
    const loadBetaApplications = () => {
        applicationsList.innerHTML = '<p>Loading beta applications...</p>'; // Initial loading message

        const applicationsRef = ref(database, 'applications');

        onValue(applicationsRef, (snapshot) => {
            if (snapshot.exists()) {
                applicationsList.innerHTML = ''; // Clear loading message
                const applicationsData = snapshot.val();

                Object.keys(applicationsData).forEach(appId => {
                    const app = applicationsData[appId];
                    const appCard = document.createElement('div');
                    appCard.className = 'application-card';
                    appCard.innerHTML = `
                        <h4>${app.name}</h4>
                        <p>Email: ${app.email}</p>
                        <p>Playdate Owner: ${app.playdateOwner}</p>
                        <p>Experience: ${app.experience || 'None'}</p>
                        <p>Status: ${app.status}</p>
                        <div class="application-actions">
                            <button class="btn-secondary approve-btn" data-app-id="${appId}">Approve</button>
                            <button class="btn-outline deny-btn" data-app-id="${appId}">Deny</button>
                        </div>
                    `;
                    applicationsList.appendChild(appCard);
                });
                // Add event listeners for Approve/Deny buttons after they are created (important!)
                attachActionButtonsListeners();
            } else {
                applicationsList.innerHTML = '<p>No beta applications yet.</p>';
            }
        }, (error) => {
            console.error("Error fetching applications:", error);
            applicationsList.innerHTML = '<p class="error">Error loading applications.</p>';
        });
    };

    // Function to attach event listeners to Approve/Deny buttons (after they are dynamically added)
    const attachActionButtonsListeners = () => {
        applicationsList.addEventListener('click', function(event) {
            if (event.target.classList.contains('approve-btn')) {
                const appId = event.target.dataset.appId;
                handleApproveApplication(appId);
            } else if (event.target.classList.contains('deny-btn')) {
                const appId = event.target.dataset.appId;
                handleDenyApplication(appId);
            }
        });
    };

    // Function to handle application approval
    const handleApproveApplication = async (appId) => {
        console.log(`Approve application: ${appId}`);
        // alert(`Approve action for application ID: ${appId} - Functionality to be implemented.`); // Removed placeholder alert

        const applicationsRef = ref(database, `applications/${appId}`);
        const snapshot = await get(applicationsRef);
        if (!snapshot.exists()) {
            alert('Application not found.');
            return;
        }
        const appData = snapshot.val();
        const userEmail = appData.email; // Get user's email from application data

        adminLoginMessage.textContent = 'Approving application...'; // Use admin message for feedback
        adminLoginMessage.className = 'form-message';

        try {
            // 1. Sign in user temporarily to get UID
            const userCredential = await signInWithEmailAndPassword(auth, userEmail, generateRandomPassword()); // Use temp password
            const user = userCredential.user;
            const uid = user.uid; // Get Firebase UID

            // 2. Find the beta code associated with this email (assuming 1 code per email for now)
            const betaCodesRef = ref(database, 'betaCodes');
            const betaCodesSnapshot = await get(betaCodesRef);
            let associatedBetaCodeKey = null;
            if (betaCodesSnapshot.exists()) {
                const betaCodes = betaCodesSnapshot.val();
                for (const key in betaCodes) {
                    if (betaCodes[key].email === userEmail) {
                        associatedBetaCodeKey = key;
                        break; // Found the beta code
                    }
                }
            }

            if (associatedBetaCodeKey) {
                // 3. Update beta code entry with UID
                const betaCodeUserRef = ref(database, `betaCodes/${associatedBetaCodeKey}/uid`);
                await set(betaCodeUserRef, uid);
                console.log(`Beta code ${betaCodes[associatedBetaCodeKey].code} associated with UID: ${uid}`);

                // 4. (Optional) Update application entry with UID - if you want to store it there too
                const applicationUserRef = ref(database, `applications/${appId}/uid`);
                await set(applicationUserRef, uid);

                // 5. Update application status to 'approved'
                const applicationStatusRef = ref(database, `applications/${appId}/status`);
                await set(applicationStatusRef, 'approved');

                // 6. Sign out admin user (important!)
                await signOut(auth);

                adminLoginMessage.textContent = 'Application approved successfully!';
                adminLoginMessage.className = 'form-message success';
                loadBetaApplications(); // Refresh application list
                alert('Application approved and UID associated!'); // User feedback alert

            } else {
                adminLoginMessage.textContent = 'Error: Beta code not found for this user.';
                adminLoginMessage.className = 'form-message error';
                alert('Error: Beta code not found for this user. Approval failed.');
                await signOut(auth); // Still sign out admin in case of error
            }


        } catch (error) {
            console.error("Error approving application:", error);
            adminLoginMessage.textContent = 'Error approving application. See console for details.';
            adminLoginMessage.className = 'form-message error';
            alert('Error approving application. Check console. Error: ' + error.message);
            await signOut(auth); // Sign out admin on error
        }
    };

    // Function to handle application denial
    const handleDenyApplication = async (appId) => {
        console.log(`Deny application: ${appId}`);
        // alert(`Deny action for application ID: ${appId} - Functionality to be implemented.`); // Removed placeholder alert

        const applicationsRef = ref(database, `applications/${appId}`);
        const snapshot = await get(applicationsRef);
        if (!snapshot.exists()) {
            alert('Application not found.');
            return;
        }
        // No need to get email or UID for denial

        adminLoginMessage.textContent = 'Denying application...'; // Use admin message for feedback
        adminLoginMessage.className = 'form-message';

        try {
            // 1. Update application status to 'denied'
            const applicationStatusRef = ref(database, `applications/${appId}/status`);
            await set(applicationStatusRef, 'denied');

            adminLoginMessage.textContent = 'Application denied successfully!';
            adminLoginMessage.className = 'form-message success';

            // ✅ Remove the application card from the list in the UI
            const applicationCardToRemove = document.querySelector(`.application-card .deny-btn[data-app-id="${appId}"]`).closest('.application-card');
            if (applicationCardToRemove) {
                applicationCardToRemove.remove();
            }

            alert('Application denied!'); // User feedback alert

        } catch (error) {
            console.error("Error denying application:", error);
            adminLoginMessage.textContent = 'Error denying application. See console for details.';
            adminLoginMessage.className = 'form-message error';
            alert('Error denying application. Check console. Error: ' + error.message);
        }
    };

    // Sign out user
    const signOutUser = () => {
        currentUser = null;
        validatedBetaCode = null;
        localStorage.removeItem('betaUserSession');
        updateAuthUI(false); // ✅ Call updateAuthUI for sign out
        adminPortal.classList.remove('active'); // Hide admin portal on sign out
        adminDashboard.classList.add('hidden'); // Hide admin dashboard on sign out
        adminLoginForm.classList.remove('hidden'); // Show admin login form again
    };

    // Update the UI based on authentication state (Modified to handle admin UI)
    const updateAuthUI = (isLoggedIn, isAdmin = false) => { // ✅ Added isAdmin parameter
        if (isLoggedIn && currentUser) {
            // Update auth status in nav
            authStatus.classList.add('logged-in');
            if (isAdmin) { // ✅ Admin user UI
                loginLink.textContent = `Admin`; // Or use your email prefix: `${currentUser.email.split('@')[0]}`
                loginLink.href = '#admin-portal'; // Link to admin portal
                authStatus.classList.add('admin-mode-header'); // Add class for admin header styling
            } else { // Beta user UI (existing)
                loginLink.textContent = `${currentUser.email.split('@')[0]}`;
                loginLink.href = '#account';
                authStatus.classList.remove('admin-mode-header'); // Ensure class is removed in beta user mode
            }

            // Show feedback forms and hide login prompt (existing)
            if (feedbackLoginPrompt) feedbackLoginPrompt.classList.add('hidden');
            if (feedbackForms) feedbackForms.classList.remove('hidden');

            // Show download section if it exists (existing)
            if (downloadSection) downloadSection.classList.remove('hidden');

            // Add dropdown menu (Modified for Admin Portal link)
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown-menu';
            dropdown.innerHTML = `
                <ul>
                    ${isAdmin ? `<li><a href="#admin-portal" id="admin-portal-link-dropdown">Admin Portal</a></li>` : ''}
                    <li><button id="sign-out-btn" class="btn-outline">Sign Out</button></li>
                </ul>
            `;

            // Only add dropdown if it doesn't already exist
            if (!authStatus.querySelector('.dropdown-menu')) {
                authStatus.appendChild(dropdown);
                document.getElementById('sign-out-btn').addEventListener('click', signOutUser);
                if (isAdmin) { // ✅ Event listener for Admin Portal dropdown link
                    document.getElementById('admin-portal-link-dropdown').addEventListener('click', (e) => {
                        e.preventDefault();
                        adminPortal.classList.add('active'); // Show admin portal when clicked in dropdown
                        adminPortal.classList.remove('initially-hidden'); // Ensure it's not hidden by initial class
                    });
                }
            }
        } else {
            // Update auth status in nav
            authStatus.classList.remove('logged-in');
            loginLink.textContent = 'Log In';
            loginLink.href = '#login';
            authStatus.classList.remove('admin-mode-header'); // Ensure class is removed when logged out
            
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
    
    // Beta Application Form (Modified for Email Verification and App Check)
    if (betaSignupForm) {
        betaSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Get form data
            const formData = new FormData(betaSignupForm);
            const formValues = Object.fromEntries(formData.entries());

            signupMessage.textContent = 'Submitting application...';
            signupMessage.className = 'form-message';

            try {
                // **2. Create User with Email and Password (for verification)**
                const userCredential = await createUserWithEmailAndPassword(auth, formValues.email, generateRandomPassword());
                const user = userCredential.user;

                // **3. Send Email Verification**
                await sendEmailVerification(user);

                // **4. Save Application Data to Firebase**
                const applicationsRef = ref(database, 'applications');
                const newApplicationRef = child(applicationsRef, `${Date.now()}`);

                const applicationData = {
                    name: formValues.name,
                    email: formValues.email,
                    playdateOwner: formValues['playdate-owner'],
                    experience: formValues.experience || '',
                    timestamp: new Date().toISOString(),
                    status: 'pending', // Application is pending admin approval
                    project: '8ball',
                };

                await set(newApplicationRef, applicationData);

                // **5. Show Success Message**
                signupMessage.textContent = 'Application submitted! Please check your email to verify your address. Your application is pending admin approval.';
                signupMessage.className = 'form-message success';

                // Clear the form
                betaSignupForm.reset();

            } catch (error) {
                console.error("Error during beta application:", error);
                if (error.code === 'auth/email-already-in-use') {
                    signupMessage.textContent = 'This email is already registered. If you\'ve already applied, your application is being reviewed. If not, please use a different email.';
                } else {
                    signupMessage.textContent = 'Error submitting application. Please try again later.';
                }
                signupMessage.className = 'form-message error';
            }
        });
    }

    // Function to generate a random password (temporary for email verification)
    function generateRandomPassword() {
        return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
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

            const targetHref = this.getAttribute('href');
            if (targetHref && targetHref !== "#" && targetHref !== '') { // ✅ Check for empty or just '#' href
                const targetId = targetHref;
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            } else {
                console.warn('Invalid or empty href attribute, smooth scroll skipped.');
            }
        });
    });
    
    // Admin Portal Elements
    const adminPortal = document.getElementById('admin-portal');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLoginMessage = document.getElementById('admin-login-message');
    const adminDashboard = document.getElementById('admin-dashboard');
    const applicationsList = document.getElementById('applications-list');
    const adminSignOutBtn = document.getElementById('admin-sign-out-btn');

    // Admin Portal Functionality
    const initAdminPortal = () => {
        // Check if admin is already logged in (session persistence - optional for now)
        // For simplicity, we'll just show the login form initially

        // Admin Login Form Submission
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('admin-email').value.trim();
                const password = document.getElementById('admin-password').value.trim();

                adminLoginMessage.textContent = 'Logging in...';
                adminLoginMessage.className = 'form-message';

                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    adminLoginForm.classList.add('hidden');
                    adminDashboard.classList.remove('hidden');
                    adminLoginMessage.textContent = '';
                    // loadBetaApplications();
                    alert('Admin login successful!');
                } catch (error) {
                    console.error("Admin login error:", error);
                    adminLoginMessage.textContent = 'Invalid credentials. Please try again.';
                    adminLoginMessage.className = 'form-message error';
                    alert('Admin login failed. Check credentials and console.');
                }
            });
        }

        // Admin Sign Out
        if (adminSignOutBtn) {
            adminSignOutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    adminDashboard.classList.add('hidden');
                    adminLoginForm.classList.remove('hidden');
                    applicationsList.innerHTML = '<p>Loading applications...</p>';
                    adminLoginMessage.textContent = '';
                    adminLoginMessage.className = 'form-message';
                    alert('Admin signed out.');
                } catch (error) {
                    console.error("Admin sign out error:", error);
                    alert('Error signing out admin.');
                }
            });
        }

        // "View Website" Button Event Listener
        if (viewWebsiteBtn) {
            viewWebsiteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                adminPortal.classList.remove('active'); // Hide Admin Portal
                adminPortal.classList.add('hidden');
                // Optionally scroll back to top or a relevant section
                window.scrollTo({ top: 0, behavior: 'smooth' }); // Example: Scroll to top
            });
        }
    };
    
    // Function to load bug reports from Firebase
    const loadBugReports = () => {
        bugReportsList.innerHTML = '<p>Loading bug reports...</p>';
        const bugReportsRef = ref(database, 'feedback/bugs');
        onValue(bugReportsRef, (snapshot) => {
            if (snapshot.exists()) {
                bugReportsList.innerHTML = '';
                const reportsData = snapshot.val();
                Object.keys(reportsData).forEach(reportId => {
                    const report = reportsData[reportId];
                    const reportCard = createFeedbackCard(report, 'bug'); // Re-use or create a card function
                    bugReportsList.appendChild(reportCard);
                });
            } else {
                bugReportsList.innerHTML = '<p>No bug reports yet.</p>';
            }
        }, (error) => {
            console.error("Error fetching bug reports:", error);
            bugReportsList.innerHTML = '<p class="error">Error loading bug reports.</p>';
        });
    };

    // Function to load feature requests from Firebase
    const loadFeatureRequests = () => {
        featureRequestsList.innerHTML = '<p>Loading feature requests...</p>';
        const featureRequestsRef = ref(database, 'feedback/features');
        onValue(featureRequestsRef, (snapshot) => {
            if (snapshot.exists()) {
                featureRequestsList.innerHTML = '';
                const requestsData = snapshot.val();
                Object.keys(requestsData).forEach(requestId => {
                    const request = requestsData[requestId];
                    const requestCard = createFeedbackCard(request, 'feature'); // Re-use or create a card function
                    featureRequestsList.appendChild(requestCard);
                });
            } else {
                featureRequestsList.innerHTML = '<p>No feature requests yet.</p>';
            }
        }, (error) => {
            console.error("Error fetching feature requests:", error);
            featureRequestsList.innerHTML = '<p class="error">Error loading feature requests.</p>';
        });
    };

    // Function to load user ratings from Firebase
    const loadUserRatings = () => {
        userRatingsList.innerHTML = '<p>Loading user ratings...</p>';
        const userRatingsRef = ref(database, 'feedback/experiences');
        onValue(userRatingsRef, (snapshot) => {
            if (snapshot.exists()) {
                userRatingsList.innerHTML = '';
                const ratingsData = snapshot.val();
                Object.keys(ratingsData).forEach(ratingId => {
                    const rating = ratingsData[ratingId];
                    const ratingCard = createFeedbackCard(rating, 'rating'); // Re-use or create a card function
                    userRatingsList.appendChild(ratingCard);
                });
            } else {
                userRatingsList.innerHTML = '<p>No user ratings yet.</p>';
            }
        }, (error) => {
            console.error("Error fetching user ratings:", error);
            userRatingsList.innerHTML = '<p class="error">Error loading user ratings.</p>';
        });
    };

    // Helper function to create a feedback card (reusable for bugs, features, ratings)
    const createFeedbackCard = (feedback, type) => {
        const card = document.createElement('div');
        card.className = 'feedback-card'; // You might want to style this in CSS
        let cardContent = `
            <h4>${feedback.title || (type === 'rating' ? 'User Rating' : 'No Title')}</h4>
            <p>Submitted by: ${feedback.submittedBy}</p>
            <p>Timestamp: ${new Date(feedback.timestamp).toLocaleString()}</p>
            <p>Details: ${feedback.details}</p>
        `;
        if (type === 'bug') {
            cardContent += `<p>Severity: ${feedback.severity}</p><p>Status: ${feedback.status}</p>`;
        } else if (type === 'rating') {
            cardContent += `<p>Rating: ${feedback.rating} stars</p>`;
        }
        card.innerHTML = cardContent;
        return card;
    };
    
    // Initialize everything
    initAuth();
    initFeedbackForms();
}); 