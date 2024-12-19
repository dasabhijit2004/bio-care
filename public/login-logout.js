document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById("loginButton");
    const signupButton = document.getElementById("signupButton");
    const joinUsButton = document.getElementById("joinUsButton");

    // Check if the user is logged in
    const loggedIn = localStorage.getItem("loggedIn");

    if (loggedIn === "true") {
        // User is logged in
        if (joinUsButton) joinUsButton.style.display = "none"; // Hide Join Us button
        if (signupButton) signupButton.style.display = "none"; // Hide Sign Up button
        loginButton.innerHTML = "Log Out"; // Change button text to Log Out
    }

    // Login/Logout Button Click Event
    loginButton.addEventListener("click", (e) => {
        e.preventDefault();
        if (localStorage.getItem("loggedIn") === "true") {
            // Log out the user
            localStorage.removeItem("loggedIn");
            alert("You have logged out successfully!");
            location.reload(); // Refresh the page to update UI
        } else {
            // Redirect to login page
            window.location.href = "login.html";
        }
    });
});
