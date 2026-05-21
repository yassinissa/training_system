(function($) {
    $(document).ready(function() {
        function toggleFields() {
            const role = $("#id_role").val();

            const empBranch = $("#id_employee_branch").closest(".form-row");
            const mgrBranches = $("#id_manager_branches").closest(".form-row");

            if (role === "ADMIN") {
                empBranch.hide();
                mgrBranches.hide();
            } else if (role === "MANAGER") {
                empBranch.hide();
                mgrBranches.show();
            } else if (role === "EMPLOYEE") {
                empBranch.show();
                mgrBranches.hide();
            }
        }

        $("#id_role").change(toggleFields);
        toggleFields(); // Initial call
    });
})(django.jQuery);
