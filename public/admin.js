// admin.js

document.addEventListener('DOMContentLoaded', function () {
    // Check if the user is logged in and if they are an admin
    const isLoggedIn = localStorage.getItem('isLoggedIn');  // Example check for login status
    const isAdmin = localStorage.getItem('isAdmin');        // Example check for admin status

    // Get the admin action buttons
    const addCourseButton = document.getElementById('addCourseButton');
    const deleteCourseButton = document.getElementById('deleteCourseButton');

    // If the user is logged in and is an admin, show the buttons
    if (isLoggedIn && isAdmin === 'true') {
        addCourseButton.style.display = 'inline-block';
        deleteCourseButton.style.display = 'inline-block';
    } else {
        addCourseButton.style.display = 'none';
        deleteCourseButton.style.display = 'none';
    }

    // Example logic to handle button clicks (you can modify as per your needs)
    addCourseButton.addEventListener('click', function () {
        alert("Adding a course..."); // Replace with actual add course functionality
    });

    deleteCourseButton.addEventListener('click', function () {
        alert("Deleting a course..."); // Replace with actual delete course functionality
    });
});
