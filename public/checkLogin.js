// Check if the user is logged in
document.addEventListener("DOMContentLoaded", function () {
    // Check localStorage for a key 'loggedIn'. If it's 'true', the user is logged in.
    const loggedIn = localStorage.getItem("loggedIn");

    // Get the courses content and overlay
    const content = document.querySelector('.courses') || document.querySelector('.gallery') || document.querySelector('.events');
    const overlay = document.getElementById("overlay");

    // If user is logged in, remove the blur effect and hide the overlay
    if (loggedIn === "true") {
        content.classList.remove("blur"); // Remove the blur effect
        overlay.style.display = "none"; // Hide the overlay
    } else {
        // If user is not logged in, blur the content and display the overlay
        content.classList.add("blur"); // Apply the blur effect
        overlay.style.display = "flex"; // Show the overlay
    }
});
